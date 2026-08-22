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
            'MCP_DISCOVERY_STARTED',
            'MCP_DISCOVERY_COMPLETED',
            'ACTION_STARTED',
            'ACTION_COMPLETED',
            'FINAL_RESPONSE_GENERATED',
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

    @patch('requests.post')
    def test_direct_answer(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "candidates": [{"content": {"parts": [{"text": "The answer is 112"}]}}]
        }
        mock_post.return_value = mock_response

        self.client.force_authenticate(user=self.user_a)
        self.client.post('/api/v1/settings/providers/gemini/', {"api_key": "GEMINI_KEY"})

        task = Task.objects.create(
            workspace=self.workspace_a,
            creator=self.user_a,
            problem_statement="What is 56 * 2?",
            assigned_agent=self.agent_gemini,
            status="PENDING"
        )

        exec_service = ExecutionService()
        execution = exec_service.execute_task(task, user=self.user_a)

        self.assertEqual(execution.status, 'COMPLETED')
        self.assertEqual(execution.result, "The answer is 112")
        
        # Verify no tool events were logged
        events = ExecutionEvent.objects.filter(task=task)
        event_types = [e.event_type for e in events]
        self.assertNotIn('TOOL_STARTED', event_types)

    @patch('requests.post')
    def test_tool_usage_mcp(self, mock_post):
        # We need two responses: first requests tool call, second returns final summary
        mock_resp_1 = MagicMock()
        mock_resp_1.status_code = 200
        mock_resp_1.json.return_value = {
            "candidates": [{"content": {"parts": [{"text": '{"tool_call": {"name": "filesystem.list_directory", "arguments": {"path": "."}}}'}]}}]
        }

        mock_resp_2 = MagicMock()
        mock_resp_2.status_code = 200
        mock_resp_2.json.return_value = {
            "candidates": [{"content": {"parts": [{"text": "I found these files: manage.py"}]}}]
        }

        mock_post.side_effect = [mock_resp_1, mock_resp_2]

        self.client.force_authenticate(user=self.user_a)
        self.client.post('/api/v1/settings/providers/gemini/', {"api_key": "GEMINI_KEY"})

        task = Task.objects.create(
            workspace=self.workspace_a,
            creator=self.user_a,
            problem_statement="List Python files",
            assigned_agent=self.agent_gemini,
            status="PENDING"
        )

        exec_service = ExecutionService()
        # Mock registry discovery so it doesn't spawn real servers for this request test
        with patch('task.services.mcp.registry.MCPRegistry') as mock_registry_class:
            mock_registry_inst = MagicMock()
            mock_registry_inst.discover_tools.return_value = [{
                "name": "filesystem.list_directory",
                "server": "filesystem",
                "description": "List files",
                "input_schema": {},
                "type": "mcp"
            }]
            mock_registry_inst.tools = {
                "filesystem.list_directory": (MagicMock(), {
                    "name": "filesystem.list_directory",
                    "server": "filesystem",
                    "description": "List files",
                    "input_schema": {},
                    "type": "mcp",
                    "original_name": "list_directory"
                })
            }
            mock_registry_inst.execute_tool.return_value = {"result": "manage.py"}
            mock_registry_class.return_value = mock_registry_inst

            execution = exec_service.execute_task(task, user=self.user_a)

            self.assertEqual(execution.status, 'COMPLETED')
            self.assertEqual(execution.result, "I found these files: manage.py")

            # Verify events logged
            events = ExecutionEvent.objects.filter(task=task)
            event_types = [e.event_type for e in events]
            self.assertIn('MCP_DISCOVERY_STARTED', event_types)
            self.assertIn('MCP_DISCOVERY_COMPLETED', event_types)
            self.assertIn('TOOL_SELECTED', event_types)
            self.assertIn('TOOL_STARTED', event_types)
            self.assertIn('TOOL_COMPLETED', event_types)

    def test_bash_fallback_security(self):
        from task.services.capability_registry import CapabilityRegistry
        registry = CapabilityRegistry()

        # Safe command works
        res = registry.execute_tool("bash.execute", {"command": "echo hello"})
        self.assertEqual(res.get("exit_code"), 0)
        self.assertIn("hello", res.get("stdout"))

        # Destructive command is blocked
        res_blocked = registry.execute_tool("bash.execute", {"command": "sudo rm -rf /"})
        self.assertIn("error", res_blocked)

        # File deletion blocked
        res_del = registry.execute_tool("bash.execute", {"command": "rm -f file.txt"})
        self.assertIn("error", res_del)

        # Env dump blocked
        res_env = registry.execute_tool("bash.execute", {"command": "printenv"})
        self.assertIn("error", res_env)

    def test_database_security(self):
        from task.services.capability_registry import CapabilityRegistry
        registry = CapabilityRegistry()

        # Destructive query is blocked
        res_drop = registry.execute_tool("builtin.database.query", {"sql": "DROP TABLE workspace_workspace"})
        self.assertIn("error", res_drop)

        res_update = registry.execute_tool("builtin.database.query", {"sql": "UPDATE workspace_workspace SET name='Hacked'"})
        self.assertIn("error", res_update)

        res_insert = registry.execute_tool("builtin.database.query", {"sql": "INSERT INTO workspace_workspace (name) VALUES ('Hacked')"})
        self.assertIn("error", res_insert)

        res_pragma = registry.execute_tool("builtin.database.query", {"sql": "PRAGMA journal_mode=WAL"})
        self.assertIn("error", res_pragma)


class MCPLayerTestCase(TestCase):
    def test_client_lifecycle_and_handshake(self):
        from task.services.mcp.client import MCPClient
        from task.services.mcp.config import PYTHON_EXECUTABLE, FILESYSTEM_SERVER_PATH
        
        client = MCPClient("filesystem", [PYTHON_EXECUTABLE, FILESYSTEM_SERVER_PATH])
        client.start()
        try:
            # Send initialize handshake
            res = client.send_request("initialize", {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "TestClient", "version": "1.0"}
            })
            self.assertNotIn("error", res)
            self.assertEqual(res.get("result", {}).get("protocolVersion"), "2024-11-05")
            
            # Send list tools request
            res_tools = client.send_request("tools/list")
            self.assertNotIn("error", res_tools)
            tools = res_tools.get("result", {}).get("tools", [])
            tool_names = [t["name"] for t in tools]
            self.assertIn("list_directory", tool_names)
            
            # Send call tool request
            res_call = client.send_request("tools/call", {
                "name": "list_directory",
                "arguments": {"path": "."}
            })
            self.assertNotIn("error", res_call)
            content = res_call.get("result", {}).get("content", [])
            self.assertTrue(len(content) > 0)
            self.assertEqual(content[0]["type"], "text")
            self.assertIn("Files", content[0]["text"])
            
            # Path traversal rejection
            res_traversal = client.send_request("tools/call", {
                "name": "list_directory",
                "arguments": {"path": "../../../.."}
            })
            self.assertNotIn("error", res_traversal)
            self.assertTrue(res_traversal.get("result", {}).get("isError"))
            
        finally:
            client.stop()

    def test_mcp_registry_discovery(self):
        from task.services.mcp.registry import MCPRegistry
        registry = MCPRegistry()
        registry.initialize_servers()
        try:
            tools = registry.discover_tools()
            tool_names = [t["name"] for t in tools]
            self.assertIn("filesystem.list_directory", tool_names)
            self.assertIn("search.search_web", tool_names)
            
            # Verify normalized tool metadata
            fs_tool = next(t for t in tools if t["name"] == "filesystem.list_directory")
            self.assertEqual(fs_tool["server"], "filesystem")
            self.assertEqual(fs_tool["type"], "mcp")
            
            # Run tool call
            res = registry.execute_tool("filesystem.list_directory", {"path": "."})
            self.assertNotIn("error", res)
            self.assertIn("Files", res["result"])
        finally:
            registry.shutdown()

    @patch('requests.post')
    def test_agent_loop_direct_answer(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "candidates": [{"content": {"parts": [{"text": "Simple multiplication result is 112"}]}}]
        }
        mock_post.return_value = mock_response

        user = User.objects.create_user(username='agent_test_user', password='password')
        from task.models import UserProviderCredential
        from task.utils.encryption import encrypt_value
        UserProviderCredential.objects.create(
            user=user,
            provider='gemini',
            encrypted_api_key=encrypt_value('fake-key')
        )
        workspace = Workspace.objects.create(name="Agent Test Workspace", owner=user, ai_provider='gemini', ai_model='gemini-2.5-flash')
        agent = Agent.objects.create(name="Gemini Agent", provider="gemini", model="gemini-2.5-flash")
        
        task = Task.objects.create(
            workspace=workspace,
            creator=user,
            problem_statement="What is 56 * 2?",
            assigned_agent=agent,
            status="PENDING"
        )

        exec_service = ExecutionService()
        with patch('task.services.mcp.registry.MCPRegistry') as mock_registry_class:
            mock_registry_inst = MagicMock()
            mock_registry_inst.discover_tools.return_value = []
            mock_registry_class.return_value = mock_registry_inst
            execution = exec_service.execute_task(task, user=user)
            self.assertEqual(execution.status, 'COMPLETED')
            self.assertEqual(execution.result, "Simple multiplication result is 112")


class MCPLoopHardeningTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='hardening_user', password='password')
        self.workspace = Workspace.objects.create(name="Hardening Workspace", owner=self.user, ai_provider='gemini', ai_model='gemini-2.5-flash')
        self.agent = Agent.objects.create(name="Hardening Agent", provider="gemini", model="gemini-2.5-flash")

    def test_bash_execute_harden_blocks(self):
        from task.services.capability_registry import CapabilityRegistry
        registry = CapabilityRegistry()

        # Blocks reading secrets file
        res = registry.execute_tool("bash.execute", {"command": "cat .env"})
        self.assertIn("error", res)
        self.assertIn("Access denied", res["error"])

        # Blocks grep secrets
        res = registry.execute_tool("bash.execute", {"command": "grep -i key .env"})
        self.assertIn("error", res)
        self.assertIn("Access denied", res["error"])

        # Blocks python/node execution
        res = registry.execute_tool("bash.execute", {"command": "python -c 'print(1)'"})
        self.assertIn("error", res)
        self.assertIn("Access denied", res["error"])

        # Blocks curl/wget
        res = registry.execute_tool("bash.execute", {"command": "curl http://example.com"})
        self.assertIn("error", res)
        self.assertIn("Access denied", res["error"])

        # Blocks nested redirection or quotes
        res = registry.execute_tool("bash.execute", {"command": "echo hello > test.txt"})
        self.assertIn("error", res)
        self.assertIn("Access denied", res["error"])

        # Blocks environment dump
        res = registry.execute_tool("bash.execute", {"command": "printenv"})
        self.assertIn("error", res)
        self.assertIn("Access denied", res["error"])

        # Safe commands pass validation
        res = registry.execute_tool("bash.execute", {"command": "git status"})
        self.assertNotIn("error", res)
        self.assertIn("exit_code", res)

    def test_real_provider_credential_failure(self):
        task = Task.objects.create(
            workspace=self.workspace,
            creator=self.user,
            problem_statement="Test credential check.",
            assigned_agent=self.agent,
            status="PENDING"
        )
        # Without credentials, execute_task must fail immediately with FAILED and mode REAL
        exec_service = ExecutionService()
        execution = exec_service.execute_task(task, user=self.user)
        self.assertIsNotNone(execution)
        self.assertEqual(execution.status, 'FAILED')
        self.assertEqual(execution.mode, 'REAL')
        self.assertEqual(task.status, 'FAILED')

    def test_unknown_provider_raises_error(self):
        # Configure unknown provider on workspace
        workspace_unknown = Workspace.objects.create(name="Unknown Workspace", owner=self.user, ai_provider='super-gpt-99', ai_model='gpt-99')
        task = Task.objects.create(
            workspace=workspace_unknown,
            creator=self.user,
            problem_statement="Test unknown provider.",
            assigned_agent=self.agent,
            status="PENDING"
        )
        exec_service = ExecutionService()
        execution = exec_service.execute_task(task, user=self.user)
        self.assertEqual(execution.status, 'FAILED')
        self.assertEqual(task.status, 'FAILED')
        self.assertIn("Unsupported AI Provider", execution.error)

    def test_centralized_sanitization(self):
        from task.services.execution_service import sanitize_data
        
        # Test key redaction in dicts
        sensitive_dict = {
            "api_key": "supersecretkey123",
            "password": "my-password",
            "Authorization": "Bearer abc123def456",
            "safe_field": "hello world"
        }
        sanitized = sanitize_data(sensitive_dict, "resolvedkey123")
        self.assertEqual(sanitized["api_key"], "••••••••")
        self.assertEqual(sanitized["password"], "••••••••")
        self.assertEqual(sanitized["Authorization"], "••••••••")
        self.assertEqual(sanitized["safe_field"], "hello world")

        # Test key replacement inside strings
        sensitive_string = "My credentials are x-goog-api-key: mygoogkey123 and key resolvedkey123"
        sanitized_str = sanitize_data(sensitive_string, "resolvedkey123")
        self.assertNotIn("resolvedkey123", sanitized_str)
        self.assertIn("••••••••", sanitized_str)

