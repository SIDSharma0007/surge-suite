from django.utils import timezone
from task.models import Task, TaskExecution, Action, ExecutionEvent
from .model_provider import RealGeminiModelProvider

class ExecutionService:
    """
    Service responsible for orchestrating task executions, calling the model
    provider, persisting Action attempts, and recording ExecutionEvents.
    """
    def __init__(self, provider=None):
        # Defaults to the RealGeminiModelProvider, but allows FakeModelProvider injection
        self.provider = provider or RealGeminiModelProvider()

    def execute_task(self, task):
        if not task.assigned_agent:
            task.status = 'FAILED'
            task.save()
            ExecutionEvent.objects.create(
                task=task,
                event_type='EXECUTION_FAILED',
                metadata={'error': 'Cannot execute task: No agent is assigned.'}
            )
            return None

        agent = task.assigned_agent
        
        # Transition Task to RUNNING state
        task.status = 'RUNNING'
        task.save()

        # Create TaskExecution record
        execution = TaskExecution.objects.create(
            task=task,
            agent=agent,
            status='RUNNING'
        )

        # Log EXECUTION_STARTED event
        ExecutionEvent.objects.create(
            task=task,
            execution=execution,
            event_type='EXECUTION_STARTED',
            metadata={'agent_id': str(agent.id), 'mode': execution.mode}
        )

        # Create Action record representing the model generation attempt
        action = Action.objects.create(
            execution=execution,
            agent=agent,
            action_type='generate_response',
            status='RUNNING',
            input_data={'prompt': task.problem_statement}
        )

        # Log ACTION_STARTED event
        ExecutionEvent.objects.create(
            task=task,
            execution=execution,
            event_type='ACTION_STARTED',
            metadata={'action_id': str(action.id), 'action_type': 'generate_response'}
        )

        try:
            prompt = task.problem_statement
            system_instruction = f"You are {agent.name}, an AI assistant. Capabilities: {', '.join(agent.capabilities)}"
            
            # Execute generation via provider boundary
            output, mode = self.provider.generate(prompt, system_instruction=system_instruction)
            
            # Save the execution mode flag (REAL or SIMULATED)
            execution.mode = mode
            execution.save()

            # Mark Action as COMPLETED
            action.status = 'COMPLETED'
            action.output_data = {'result': output}
            action.completed_at = timezone.now()
            action.save()

            # Log ACTION_COMPLETED event
            ExecutionEvent.objects.create(
                task=task,
                execution=execution,
                event_type='ACTION_COMPLETED',
                metadata={'action_id': str(action.id), 'status': 'COMPLETED'}
            )

            # Complete TaskExecution
            execution.status = 'COMPLETED'
            execution.result = output
            execution.completed_at = timezone.now()
            execution.save()

            # Update base Task state
            task.status = 'COMPLETED'
            task.result = output
            task.save()

            # Log EXECUTION_COMPLETED event
            ExecutionEvent.objects.create(
                task=task,
                execution=execution,
                event_type='EXECUTION_COMPLETED',
                metadata={'result_length': len(output)}
            )

        except Exception as e:
            # Mark Action as FAILED
            action.status = 'FAILED'
            action.output_data = {'error': str(e)}
            action.completed_at = timezone.now()
            action.save()

            # Log ACTION_COMPLETED (failed) event
            ExecutionEvent.objects.create(
                task=task,
                execution=execution,
                event_type='ACTION_COMPLETED',
                metadata={'action_id': str(action.id), 'status': 'FAILED', 'error': str(e)}
            )

            # Update TaskExecution to FAILED
            execution.status = 'FAILED'
            execution.error = str(e)
            execution.completed_at = timezone.now()
            execution.save()

            # Update base Task state
            task.status = 'FAILED'
            task.result = f"Error during execution: {str(e)}"
            task.save()

            # Log EXECUTION_FAILED event
            ExecutionEvent.objects.create(
                task=task,
                execution=execution,
                event_type='EXECUTION_FAILED',
                metadata={'error': str(e)}
            )

        return execution
