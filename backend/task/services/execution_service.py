from django.utils import timezone
from task.models import Task, TaskExecution, Action, ExecutionEvent
from .model_provider import RealGeminiModelProvider, FakeModelProvider

class ExecutionService:
    """
    Service responsible for orchestrating task executions, calling the model
    provider, persisting Action attempts, and recording ExecutionEvents.
    """
    def __init__(self, provider=None):
        # Defaults to the RealGeminiModelProvider, but allows FakeModelProvider injection
        self.provider = provider or RealGeminiModelProvider()

    def execute_task(self, task, user=None):
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
        
        # Determine the model provider to use.
        # If execution service was initialized with a specific provider override (e.g. FakeModelProvider for tests), we use it.
        # Otherwise, we resolve it based on agent.provider.
        is_override = self.provider and not isinstance(self.provider, RealGeminiModelProvider)
        
        if is_override:
            model_provider = self.provider
            is_real = not isinstance(self.provider, FakeModelProvider)
            provider_name = 'simulated'
            model_name = 'dev-mock'
            resolved_key = None
        else:
            workspace = task.workspace
            provider_name = workspace.ai_provider or 'simulated'
            model_name = workspace.ai_model or 'dev-mock'
            
            from .model_provider import get_model_provider_by_name
            model_provider, is_real = get_model_provider_by_name(provider_name)
            
            # Resolve key for real providers
            if is_real:
                from task.models import UserProviderCredential
                from task.utils.encryption import decrypt_value
                
                target_user = user or task.creator
                try:
                    cred = UserProviderCredential.objects.get(user=target_user, provider=provider_name.lower())
                    resolved_key = decrypt_value(cred.encrypted_api_key)
                except UserProviderCredential.DoesNotExist:
                    resolved_key = None
                    
                if not resolved_key:
                    # Key is missing!
                    task.status = 'FAILED'
                    task.save()
                    
                    execution = TaskExecution.objects.create(
                        task=task,
                        agent=agent,
                        status='FAILED',
                        mode='REAL',
                        provider=provider_name,
                        model=model_name,
                        error=f"Configure this provider under Settings → AI Providers."
                    )
                    
                    ExecutionEvent.objects.create(
                        task=task,
                        execution=execution,
                        event_type='EXECUTION_FAILED',
                        metadata={'error': f"Configure this provider under Settings → AI Providers."}
                    )
                    return execution
            else:
                resolved_key = None

        # Transition Task to RUNNING state
        task.status = 'RUNNING'
        task.save()

        # Create TaskExecution record
        execution = TaskExecution.objects.create(
            task=task,
            agent=agent,
            status='RUNNING',
            mode='REAL' if is_real else 'SIMULATED',
            provider=provider_name,
            model=model_name
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
            
            # Execute generation via provider boundary, passing API key and execution model snapshot
            output, mode = model_provider.generate(
                prompt, 
                system_instruction=system_instruction,
                api_key=resolved_key,
                model=execution.model
            )
            
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
