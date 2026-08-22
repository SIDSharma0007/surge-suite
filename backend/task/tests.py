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
        class FailingModelProvider(FakeModelProvider):
            def generate(self, prompt, system_instruction=None, *args, **kwargs):
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


from unittest.mock import patch, MagicMock
from .models import UserProviderCredential
from .utils.encryption import encrypt_value, decrypt_value

class ProviderCredentialsTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user_a = User.objects.create_user(username='user_a_cred', password='password_a')
        self.user_b = User.objects.create_user(username='user_b_cred', password='password_b')
        self.workspace_a = Workspace.objects.create(
            name="User A's Workspace", 
            owner=self.user_a,
            ai_provider='gemini',
            ai_model='gemini-2.5-flash'
        )
        
        # Clear any agents created by migrations during setup
        Agent.objects.all().delete()
        
        self.agent_gemini = Agent.objects.create(
            name="Gemini Agent",
            provider="gemini",
            model="gemini-2.5-flash",
            status="ACTIVE"
        )
        self.agent_groq = Agent.objects.create(
            name="Groq Agent",
            provider="groq",
            model="llama3-8b-8192",
            status="ACTIVE"
        )

    def test_credential_save_retrieve_delete_flow(self):
        # 1. Unauthenticated save fails
        response = self.client.post('/api/v1/settings/providers/gemini/', {"api_key": "testkey123"})
        self.assertEqual(response.status_code, 401)

        # 2. Authenticated save succeeds
        self.client.force_authenticate(user=self.user_a)
        response = self.client.post('/api/v1/settings/providers/gemini/', {"api_key": "testkey123"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["configured"], True)
        self.assertEqual(response.data["masked_key"], "••••••••y123")

        # 3. GET status maps configured status and masks key
        response = self.client.get('/api/v1/settings/providers/')
        self.assertEqual(response.status_code, 200)
        
        gemini_status = next(p for p in response.data if p["provider"] == "gemini")
        self.assertEqual(gemini_status["configured"], True)
        self.assertEqual(gemini_status["masked_key"], "••••••••y123")
        
        groq_status = next(p for p in response.data if p["provider"] == "groq")
        self.assertEqual(groq_status["configured"], False)
        self.assertIsNone(groq_status["masked_key"])

        # 4. Plaintext key is NOT returned
        for item in response.data:
            self.assertNotEqual(item.get("masked_key"), "testkey123")
            self.assertNotIn("api_key", item)
            self.assertNotIn("encrypted_api_key", item)

        # 5. DB stores encrypted value
        cred = UserProviderCredential.objects.get(user=self.user_a, provider="gemini")
        self.assertNotEqual(cred.encrypted_api_key, "testkey123")
        self.assertEqual(decrypt_value(cred.encrypted_api_key), "testkey123")

        # 6. DELETE clears key
        response = self.client.delete('/api/v1/settings/providers/gemini/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["configured"], False)
        self.assertIsNone(response.data["masked_key"])
        
        self.assertFalse(UserProviderCredential.objects.filter(user=self.user_a, provider="gemini").exists())

    def test_multi_user_isolation(self):
        # User A saves KEY_A
        self.client.force_authenticate(user=self.user_a)
        self.client.post('/api/v1/settings/providers/gemini/', {"api_key": "KEY_A"})

        # User B saves KEY_B
        self.client.force_authenticate(user=self.user_b)
        self.client.post('/api/v1/settings/providers/gemini/', {"api_key": "KEY_B"})

        # Assert User A cannot read User B's credential status
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get('/api/v1/settings/providers/')
        gemini_status = next(p for p in response.data if p["provider"] == "gemini")
        self.assertEqual(gemini_status["masked_key"], "••••••••EY_A")

        # Assert User A cannot modify User B's credential
        self.client.post('/api/v1/settings/providers/gemini/', {"api_key": "KEY_A_NEW"})
        self.assertEqual(decrypt_value(UserProviderCredential.objects.get(user=self.user_a, provider="gemini").encrypted_api_key), "KEY_A_NEW")
        self.assertEqual(decrypt_value(UserProviderCredential.objects.get(user=self.user_b, provider="gemini").encrypted_api_key), "KEY_B")

        # Assert User A cannot delete User B's credential
        self.client.delete('/api/v1/settings/providers/gemini/')
        self.assertFalse(UserProviderCredential.objects.filter(user=self.user_a, provider="gemini").exists())
        self.assertTrue(UserProviderCredential.objects.filter(user=self.user_b, provider="gemini").exists())

    @patch('requests.post')
    def test_provider_execution_key_resolution(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "candidates": [{"content": {"parts": [{"text": "Gemini response"}]}}]
        }
        mock_post.return_value = mock_response

        # User A saves GEMINI_KEY
        self.client.force_authenticate(user=self.user_a)
        self.client.post('/api/v1/settings/providers/gemini/', {"api_key": "GEMINI_KEY_A"})

        task = Task.objects.create(
            workspace=self.workspace_a,
            creator=self.user_a,
            problem_statement="Research AI Studio",
            assigned_agent=self.agent_gemini,
            status="PENDING"
        )

        exec_service = ExecutionService()
        execution = exec_service.execute_task(task, user=self.user_a)

        self.assertEqual(execution.status, 'COMPLETED')
        self.assertEqual(execution.mode, 'REAL')
        self.assertEqual(execution.result, "Gemini response")

        # Assert correct header was sent to Google API
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        self.assertEqual(kwargs['headers']['x-goog-api-key'], 'GEMINI_KEY_A')
        self.assertNotIn('key=', args[0])

    def test_missing_credential_fails_execution(self):
        task = Task.objects.create(
            workspace=self.workspace_a,
            creator=self.user_a,
            problem_statement="Research AI Studio",
            assigned_agent=self.agent_gemini,
            status="PENDING"
        )

        exec_service = ExecutionService()
        execution = exec_service.execute_task(task, user=self.user_a)

        task.refresh_from_db()
        self.assertEqual(task.status, 'FAILED')
        self.assertEqual(execution.status, 'FAILED')
        self.assertEqual(execution.mode, 'REAL')
        self.assertEqual(execution.error, "Configure this provider under Settings → AI Providers.")

        self.assertNotEqual(execution.result, "[Simulated Response]")
        self.assertNotIn("simulated", execution.error.lower())

    @patch('requests.post')
    def test_credential_leak_prevention(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "Groq response"}}]
        }
        mock_post.return_value = mock_response

        # Save Groq Key
        self.client.force_authenticate(user=self.user_a)
        self.client.post('/api/v1/settings/providers/groq/', {"api_key": "GROQ_SECRET_KEY_1234"})

        # Configure workspace for Groq
        self.workspace_a.ai_provider = 'groq'
        self.workspace_a.ai_model = 'llama3-8b-8192'
        self.workspace_a.save()

        task = Task.objects.create(
            workspace=self.workspace_a,
            creator=self.user_a,
            problem_statement="Research Groq API",
            assigned_agent=self.agent_groq,
            status="PENDING"
        )

        exec_service = ExecutionService()
        execution = exec_service.execute_task(task, user=self.user_a)

        self.assertEqual(execution.status, 'COMPLETED')
        self.assertEqual(execution.mode, 'REAL')

        actions = Action.objects.filter(execution=execution)
        for act in actions:
            self.assertNotIn("GROQ_SECRET_KEY_1234", str(act.input_data))
            self.assertNotIn("GROQ_SECRET_KEY_1234", str(act.output_data))

        events = ExecutionEvent.objects.filter(task=task)
        for event in events:
            self.assertNotIn("GROQ_SECRET_KEY_1234", str(event.metadata))

        self.assertNotIn("GROQ_SECRET_KEY_1234", str(execution.result))
        self.assertNotIn("GROQ_SECRET_KEY_1234", str(execution.error))
        self.assertNotIn("GROQ_SECRET_KEY_1234", str(task.result))

    @patch('requests.post')
    def test_workspace_model_selection_propagation(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "candidates": [{"content": {"parts": [{"text": "Gemini response"}]}}]
        }
        mock_post.return_value = mock_response

        # Save Gemini API Key
        self.client.force_authenticate(user=self.user_a)
        self.client.post('/api/v1/settings/providers/gemini/', {"api_key": "GEMINI_KEY_A"})

        # Configure workspace for Gemini 2.5 Pro
        self.workspace_a.ai_provider = 'gemini'
        self.workspace_a.ai_model = 'gemini-2.5-pro'
        self.workspace_a.save()

        task = Task.objects.create(
            workspace=self.workspace_a,
            creator=self.user_a,
            problem_statement="Explain quantum computing",
            assigned_agent=self.agent_gemini,
            status="PENDING"
        )

        exec_service = ExecutionService()
        execution = exec_service.execute_task(task, user=self.user_a)

        self.assertEqual(execution.status, 'COMPLETED')
        self.assertEqual(execution.mode, 'REAL')

        # Assert correct URL was constructed with selected model name
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        self.assertIn('/models/gemini-2.5-pro:generateContent', args[0])

    def test_workspace_provider_snapshot(self):
        # Configure workspace for simulated
        self.workspace_a.ai_provider = 'simulated'
        self.workspace_a.ai_model = 'dev-mock'
        self.workspace_a.save()

        task = Task.objects.create(
            workspace=self.workspace_a,
            creator=self.user_a,
            problem_statement="Test simulated snapshot",
            assigned_agent=self.agent_gemini,
            status="PENDING"
        )

        exec_service = ExecutionService()
        execution = exec_service.execute_task(task, user=self.user_a)

        self.assertEqual(execution.status, 'COMPLETED')
        self.assertEqual(execution.mode, 'SIMULATED')
        
        # Verify immutable snapshots are saved on TaskExecution record
        self.assertEqual(execution.provider, 'simulated')
        self.assertEqual(execution.model, 'dev-mock')
