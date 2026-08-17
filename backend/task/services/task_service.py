from django.db import transaction
from task.models import Task, ExecutionEvent
from .routing_service import RoutingService

class TaskService:
    """
    Service responsible for creating tasks, resolving agents via routing,
    and recording lifecycle events.
    """
    def __init__(self, routing_service=None):
        self.routing_service = routing_service or RoutingService()

    def create_task(self, workspace, creator, problem_statement):
        with transaction.atomic():
            task = Task.objects.create(
                workspace=workspace,
                creator=creator,
                problem_statement=problem_statement,
                status='PENDING'
            )
            
            # Log TASK_CREATED event
            ExecutionEvent.objects.create(
                task=task,
                event_type='TASK_CREATED',
                metadata={'creator': creator.username, 'workspace_id': str(workspace.id)}
            )

            # Route task to appropriate agent based on capability
            agent, capability = self.routing_service.route_task(problem_statement)
            if agent:
                task.assigned_agent = agent
                task.save()
                
                # Log AGENT_SELECTED event
                ExecutionEvent.objects.create(
                    task=task,
                    event_type='AGENT_SELECTED',
                    metadata={
                        'agent_id': str(agent.id),
                        'agent_name': agent.name,
                        'required_capability': capability
                    }
                )
            else:
                # Log AGENT_SELECTED failed event
                ExecutionEvent.objects.create(
                    task=task,
                    event_type='AGENT_SELECTED',
                    metadata={
                        'error': 'No active agent found matching capability requirements',
                        'required_capability': capability
                    }
                )
                
            return task
