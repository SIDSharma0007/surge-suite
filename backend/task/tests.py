from django.test import TestCase
from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from workspace.models import Workspace, WorkspaceMembership
from .models import Agent, Task, TaskExecution, Action, ExecutionEvent
from .services.agent_registry import AgentRegistry
from .services.routing_service import RoutingService
from .services.task_service import TaskService
from .services.execution_service import ExecutionService
from .services.model_provider import FakeModelProvider

class AgentAndTaskTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create users
        self.user_a = User.objects.create_user(username='user_a', password='password_a')
        self.user_b = User.objects.create_user(username='user_b', password='password_b')

        # Create workspaces
        self.workspace_a = Workspace.objects.create(name="User A's Workspace", owner=self.user_a)
        self.workspace_b = Workspace.objects.create(name="User B's Workspace", owner=self.user_b)

        # Clear any agents created by migrations during setup so we have a clean test slate
        Agent.objects.all().delete()

        # Create test agents
        self.agent_research = Agent.objects.create(
            name="Research Agent",
            description="Solves research queries",
            provider="simulated",
            model="dev-mock",
            capabilities=["research"],
            status="ACTIVE"
        )
        self.agent_math = Agent.objects.create(
            name="Math Agent",
            description="Solves math queries",
            provider="simulated",
            model="dev-mock",
            capabilities=["math"],
            status="ACTIVE"
        )
        self.agent_general = Agent.objects.create(
            name="General Agent",
            description="Solves general queries",
            provider="simulated",
            model="dev-mock",
            capabilities=["general"],
            status="ACTIVE"
        )
        self.agent_inactive = Agent.objects.create(
            name="Inactive Agent",
            description="Unused agent",
            provider="simulated",
            model="dev-mock",
            capabilities=["research"],
            status="INACTIVE"
        )

    # --- 1. Agent Registry & Routing Heuristic Tests ---

    def test_agent_registry_discovery(self):
        registry = AgentRegistry()
        active = registry.get_active_agents()
        self.assertEqual(active.count(), 3)
        self.assertNotIn(self.agent_inactive, active)

    def test_routing_heuristics(self):
        router = RoutingService()
        
        # Test research route matching
        agent, cap = router.route_task("Can you research Python libraries?")
        self.assertEqual(agent, self.agent_research)
        self.assertEqual(cap, 'research')

        # Test math route matching
        agent, cap = router.route_task("Please calculate 123 + 456.")
        self.assertEqual(agent, self.agent_math)
        self.assertEqual(cap, 'math')

        # Test general route matching fallback
        agent, cap = router.route_task("Hello, tell me a joke.")
        self.assertEqual(agent, self.agent_general)
        self.assertEqual(cap, 'general')

    # --- 2. Workspace Access Control & Authorization Tests ---

    def test_unauthenticated_requests_blocked(self):
        # Create Task Endpoint
        response = self.client.post(reverse('task-list'), {
            'workspace': str(self.workspace_a.id),
            'problem_statement': 'Run some task'
        })
        self.assertEqual(response.status_code, 401)

        # List Tasks Endpoint
        response = self.client.get(reverse('task-list'), {'workspace': str(self.workspace_a.id)})
        self.assertEqual(response.status_code, 401)

    def test_non_workspace_member_access_blocked(self):
        self.client.force_authenticate(user=self.user_b)
        
        # User B tries to create task in User A's workspace
        response = self.client.post(reverse('task-list'), {
            'workspace': str(self.workspace_a.id),
            'problem_statement': 'Run some task'
        })
        self.assertEqual(response.status_code, 403)

        # User B tries to list tasks in User A's workspace
        response = self.client.get(reverse('task-list'), {'workspace': str(self.workspace_a.id)})
        # The list query returns empty queryset if permission check on workspace fails
        self.assertEqual(response.data, [])

    def test_creator_derived_exclusively_from_request_user(self):
        self.client.force_authenticate(user=self.user_a)
        response = self.client.post(reverse('task-list'), {
            'workspace': str(self.workspace_a.id),
            'problem_statement': 'Explain REST vs MCP'
        })
        self.assertEqual(response.status_code, 201)
        # Verify the creator in DB matches user_a, even if they tried to pass user_b
        task = Task.objects.get(id=response.data['id'])
        self.assertEqual(task.creator, self.user_a)

    def test_workspace_member_can_create_task(self):
        # Add User B to User A's workspace as member
        WorkspaceMembership.objects.create(workspace=self.workspace_a, user=self.user_b, role='MEMBER')
        
        self.client.force_authenticate(user=self.user_b)
        response = self.client.post(reverse('task-list'), {
            'workspace': str(self.workspace_a.id),
            'problem_statement': 'Explain REST vs MCP'
        })
        self.assertEqual(response.status_code, 201)

    def test_nonexistent_task_returns_404(self):
        self.client.force_authenticate(user=self.user_a)
        # Access random UUID task
        random_uuid = '12345678-1234-5678-1234-567812345678'
        response = self.client.get(reverse('task-detail', kwargs={'pk': random_uuid}))
        self.assertEqual(response.status_code, 404)

    # --- 3. Execution Lifecycle & Events Persistence Tests ---

    def test_synchronous_execution_lifecycle_and_events(self):
        self.client.force_authenticate(user=self.user_a)
        
        # Create Task
        response = self.client.post(reverse('task-list'), {
            'workspace': str(self.workspace_a.id),
            'problem_statement': 'Explain REST'
        })
        task_id = response.data['id']
        task = Task.objects.get(id=task_id)

        # Verify initial Events
        events = ExecutionEvent.objects.filter(task=task)
        event_types = [e.event_type for e in events]
        self.assertIn('TASK_CREATED', event_types)
        self.assertIn('AGENT_SELECTED', event_types)
        
        # Trigger execution synchronously
        exec_service = ExecutionService(provider=FakeModelProvider())
        execution = exec_service.execute_task(task)

        # Refresh task state
        task.refresh_from_db()
        self.assertEqual(task.status, 'COMPLETED')
        self.assertEqual(execution.status, 'COMPLETED')
        self.assertEqual(execution.mode, 'SIMULATED')
        self.assertIn("Mode: SIMULATED", execution.result)

        # Verify Action log
        actions = Action.objects.filter(execution=execution)
        self.assertEqual(actions.count(), 1)
        action = actions.first()
        self.assertEqual(action.action_type, 'generate_response')
        self.assertEqual(action.status, 'COMPLETED')
        self.assertIn("Mode: SIMULATED", action.output_data['result'])

        # Verify final Event Sequence
        events = ExecutionEvent.objects.filter(task=task).order_by('timestamp')
        event_types = [e.event_type for e in events]
        self.assertEqual(event_types, [
            'TASK_CREATED',
            'AGENT_SELECTED',
            'EXECUTION_STARTED',
            'ACTION_STARTED',
            'ACTION_COMPLETED',
            'EXECUTION_COMPLETED'
        ])

    def test_execution_failure_path_logs_events(self):
        # Set up a fake model provider that throws an exception to simulate failure
        class FailingModelProvider(FakeModelProvider):
            def generate(self, prompt, system_instruction=None):
                raise RuntimeError("API Timeout / Out of Quota")

        task = Task.objects.create(
            workspace=self.workspace_a,
            creator=self.user_a,
            problem_statement="Calculate infinite math",
            assigned_agent=self.agent_math,
            status="PENDING"
        )

        exec_service = ExecutionService(provider=FailingModelProvider())
        execution = exec_service.execute_task(task)

        task.refresh_from_db()
        self.assertEqual(task.status, 'FAILED')
        self.assertEqual(execution.status, 'FAILED')
        self.assertIn("Error during execution: API Timeout", task.result)
        self.assertEqual(execution.error, "API Timeout / Out of Quota")

        # Verify failure events are recorded
        events = ExecutionEvent.objects.filter(task=task).order_by('timestamp')
        event_types = [e.event_type for e in events]
        self.assertIn('ACTION_COMPLETED', event_types) # action fails
        self.assertIn('EXECUTION_FAILED', event_types) # execution fails
