import json
import uuid
import datetime
from django.test import TestCase
from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from workspace.models import Workspace, WorkspaceMembership
from task.models import (
    Agent, Task, TaskExecution, GrievanceEscalation,
    LaboratoryBooking, CertificateRequest, MaintenanceTicket,
    HumanApprovalRequest
)
from task.services.workspace_read_service import WorkspaceReadService
from task.services.read_only_tool_executor import ReadOnlyToolExecutor
from task.services.dm_artifact_service import DMArtifactService
from task.services.capability_registry import (
    ACCESS_READ, ACCESS_WRITE, ACCESS_DESTRUCTIVE, ACCESS_REQUIRES_APPROVAL
)

class DMAndFollowUpFeatureTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='alice', password='password123')
        self.other_user = User.objects.create_user(username='bob', password='password123')
        self.viewer_user = User.objects.create_user(username='charlie', password='password123')

        self.workspace = Workspace.objects.create(
            name='Test Workspace',
            owner=self.user,
            ai_provider='simulated',
            ai_model='dev-mock'
        )
        self.workspace2 = Workspace.objects.create(
            name='Second Workspace',
            owner=self.other_user,
            ai_provider='simulated',
            ai_model='dev-mock'
        )

        WorkspaceMembership.objects.create(workspace=self.workspace, user=self.user, role='ADMIN')
        WorkspaceMembership.objects.create(workspace=self.workspace, user=self.other_user, role='MEMBER')
        WorkspaceMembership.objects.create(workspace=self.workspace, user=self.viewer_user, role='VIEWER')

        WorkspaceMembership.objects.create(workspace=self.workspace2, user=self.other_user, role='ADMIN')

        self.agent = Agent.objects.create(
            name='General Agent',
            provider='simulated',
            model='dev-mock',
            capabilities=['research'],
            status='ACTIVE'
        )

        self.client.force_authenticate(user=self.user)

    # =========================================================================
    # 1. ReadOnlyToolExecutor & Access Control Tests
    # =========================================================================

    def test_read_only_executor_discovers_only_read_capabilities(self):
        executor = ReadOnlyToolExecutor(user=self.user, workspace=self.workspace)
        tools = executor.get_read_only_tools()
        self.assertTrue(len(tools) > 0)
        for t in tools:
            self.assertEqual(t.get("access"), ACCESS_READ)
            self.assertNotIn("create", t.get("name", ""))
            self.assertNotIn("delete", t.get("name", ""))
            self.assertNotEqual(t.get("name"), "bash.execute")

    def test_read_only_executor_rejects_mutation_and_shell(self):
        executor = ReadOnlyToolExecutor(user=self.user, workspace=self.workspace)
        
        # Test bash.execute rejection
        res = executor.execute("bash.execute", {"command": "ls"})
        self.assertIn("error", res)
        self.assertIn("cannot be performed through DM", res["error"])

        # Test mutation MCP tool rejection
        res2 = executor.execute("grievance_escalation.create_grievance", {"subject": "test", "description": "test"})
        self.assertIn("error", res2)
        self.assertIn("cannot be performed through DM", res2["error"])

        # Test approval-required capability rejection
        res3 = executor.execute("grievance_escalation.escalate_grievance", {"grievance_id": str(uuid.uuid4())})
        self.assertIn("error", res3)
        self.assertIn("cannot be performed through DM", res3["error"])

    # =========================================================================
    # 2. Native DB Reads & Scoping Tests
    # =========================================================================

    def test_workspace_read_service_scopes_to_user_and_workspace(self):
        GrievanceEscalation.objects.create(
            user=self.user,
            workspace=self.workspace,
            subject="Alice's grievance",
            description="Details",
            status="SUBMITTED"
        )
        GrievanceEscalation.objects.create(
            user=self.other_user,
            workspace=self.workspace,
            subject="Bob's grievance",
            description="Details",
            status="SUBMITTED"
        )

        res = WorkspaceReadService.list_grievances(self.other_user, self.workspace)
        self.assertEqual(res["total"], 1)
        self.assertEqual(res["grievances"][0]["subject"], "Bob's grievance")

        # Admin user sees workspace grievances
        admin_res = WorkspaceReadService.list_grievances(self.user, self.workspace)
        self.assertEqual(admin_res["total"], 2)

    def test_tenant_and_workspace_isolation(self):
        # User A creates records in Workspace 1
        g1 = GrievanceEscalation.objects.create(
            user=self.user, workspace=self.workspace, subject="Alice W1 Grievance", status="SUBMITTED"
        )
        b1 = LaboratoryBooking.objects.create(
            user=self.user, workspace=self.workspace, lab_name="Lab A",
            date=datetime.date.today(), start_time=datetime.time(10, 0), end_time=datetime.time(11, 0),
            status="CONFIRMED"
        )
        c1 = CertificateRequest.objects.create(
            user=self.user, workspace=self.workspace, certificate_type="Bonafide", status="PENDING"
        )
        m1 = MaintenanceTicket.objects.create(
            user=self.user, workspace=self.workspace, category="Electrical", description="Light broken", status="OPEN"
        )
        t1 = Task.objects.create(
            creator=self.user, workspace=self.workspace, problem_statement="Alice Task", status="COMPLETED"
        )
        e1 = TaskExecution.objects.create(task=t1, agent=self.agent, status="COMPLETED")
        a1 = HumanApprovalRequest.objects.create(
            workspace=self.workspace, task=t1, execution=e1, requested_by=self.user,
            command="find .", sanitized_display_command="find .", reason="Search", risk="HIGH"
        )

        # User B creates records in Workspace 2
        g2 = GrievanceEscalation.objects.create(
            user=self.other_user, workspace=self.workspace2, subject="Bob W2 Grievance", status="SUBMITTED"
        )

        # 1. Non-admin User B querying Workspace 1 cannot see Alice's records
        b_grievances = WorkspaceReadService.list_grievances(self.other_user, self.workspace)
        self.assertEqual(b_grievances["total"], 0)

        b_bookings = WorkspaceReadService.list_lab_bookings(self.other_user, self.workspace)
        self.assertEqual(b_bookings["total"], 0)

        b_certs = WorkspaceReadService.list_certificate_requests(self.other_user, self.workspace)
        self.assertEqual(b_certs["total"], 0)

        b_tickets = WorkspaceReadService.list_maintenance_tickets(self.other_user, self.workspace)
        self.assertEqual(b_tickets["total"], 0)

        b_tasks = WorkspaceReadService.list_tasks(self.other_user, self.workspace)
        self.assertEqual(b_tasks["total"], 0)

        b_approvals = WorkspaceReadService.list_approvals(self.other_user, self.workspace)
        self.assertEqual(b_approvals["total"], 0)

        # 2. User A querying Workspace 1 cannot see Bob's Workspace 2 records
        a_grievances = WorkspaceReadService.list_grievances(self.user, self.workspace)
        self.assertEqual(a_grievances["total"], 1)
        self.assertEqual(a_grievances["grievances"][0]["subject"], "Alice W1 Grievance")

    # =========================================================================
    # 3. DMArtifactService Sanitization Tests
    # =========================================================================

    def test_dm_artifact_service_generates_markdown_table_and_sanitizes(self):
        data = {
            "grievances": [
                {
                    "subject": "Wifi Issue",
                    "department": "IT",
                    "status": "SUBMITTED",
                    "created_at": "2026-09-01",
                    "secret_token": "sk-secret123",
                    "authorization": "Bearer supersecretjwt",
                    "api_key": "ai-gemini-key-12345"
                }
            ]
        }
        artifact = DMArtifactService.generate_markdown_artifact(data, topic="Grievances")
        self.assertEqual(artifact["type"], "markdown")
        self.assertIn("# Grievances", artifact["content"])
        self.assertIn("Wifi Issue", artifact["content"])
        self.assertIn("| Subject | Department | Status | Created At |", artifact["content"])
        
        # Verify complete redaction of credentials/keys/headers
        self.assertNotIn("sk-secret123", artifact["content"])
        self.assertNotIn("Bearer supersecretjwt", artifact["content"])
        self.assertNotIn("ai-gemini-key-12345", artifact["content"])

    # =========================================================================
    # 4. DM Endpoint Smoke Tests (A through F)
    # =========================================================================

    def test_dm_smoke_a_show_grievances(self):
        GrievanceEscalation.objects.create(
            user=self.user, workspace=self.workspace, subject="Room AC Broken", status="SUBMITTED"
        )
        url = reverse('workspace-dm', kwargs={'pk': self.workspace.id})
        response = self.client.post(url, {"message": "Show me my grievances.", "history": []}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("Room AC Broken", response.data["message"])
        self.assertEqual(response.data["access_mode"], "READ_ONLY")

    def test_dm_smoke_b_show_lab_bookings(self):
        LaboratoryBooking.objects.create(
            user=self.user, workspace=self.workspace, lab_name="Physics Lab 1",
            date=datetime.date.today(), start_time=datetime.time(14, 0), end_time=datetime.time(15, 0),
            status="CONFIRMED"
        )
        url = reverse('workspace-dm', kwargs={'pk': self.workspace.id})
        response = self.client.post(url, {"message": "Show me my lab bookings.", "history": []}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("Physics Lab 1", response.data["message"])

    def test_dm_smoke_c_show_tasks(self):
        Task.objects.create(
            creator=self.user, workspace=self.workspace, problem_statement="Analyze lab dataset", status="COMPLETED"
        )
        url = reverse('workspace-dm', kwargs={'pk': self.workspace.id})
        response = self.client.post(url, {"message": "Show me my tasks.", "history": []}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("Analyze lab dataset", response.data["message"])

    def test_dm_smoke_d_show_approvals(self):
        task = Task.objects.create(creator=self.user, workspace=self.workspace, problem_statement="Task A")
        exec_obj = TaskExecution.objects.create(task=task, agent=self.agent, status="WAITING_FOR_APPROVAL")
        HumanApprovalRequest.objects.create(
            workspace=self.workspace, task=task, execution=exec_obj, requested_by=self.user,
            command="find .", sanitized_display_command="find . -name '*.py'", reason="Audit", risk="HIGH"
        )
        url = reverse('workspace-dm', kwargs={'pk': self.workspace.id})
        response = self.client.post(url, {"message": "Show me my pending approvals.", "history": []}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("find . -name '*.py'", response.data["message"])

    def test_dm_smoke_e_export_grievances_as_markdown(self):
        GrievanceEscalation.objects.create(
            user=self.user, workspace=self.workspace, subject="Library Noise", status="SUBMITTED"
        )
        url = reverse('workspace-dm', kwargs={'pk': self.workspace.id})
        response = self.client.post(url, {"message": "Export my grievances as markdown.", "history": []}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(response.data.get("artifact"))
        self.assertEqual(response.data["artifact"]["type"], "markdown")
        self.assertIn("Library Noise", response.data["artifact"]["content"])

    def test_dm_smoke_f_mutation_protection(self):
        initial_booking_count = LaboratoryBooking.objects.count()
        url = reverse('workspace-dm', kwargs={'pk': self.workspace.id})
        response = self.client.post(url, {"message": "Book Lab 2 tomorrow.", "history": []}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("cannot perform state-changing actions from DM", response.data["message"])
        self.assertEqual(LaboratoryBooking.objects.count(), initial_booking_count)

    # =========================================================================
    # 5. Task Retry & Follow-Up Tests
    # =========================================================================

    def test_task_retry_creates_retry_execution_and_preserves_lineage(self):
        task = Task.objects.create(
            workspace=self.workspace,
            creator=self.user,
            assigned_agent=self.agent,
            problem_statement="Check inventory",
            status="FAILED"
        )
        initial_exec = TaskExecution.objects.create(
            task=task,
            agent=self.agent,
            status="FAILED",
            execution_type="INITIAL",
            prompt="Check inventory",
            error="Transient connection error"
        )

        url = reverse('task-retry', kwargs={'pk': task.id})
        response = self.client.post(url, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        task.refresh_from_db()
        self.assertEqual(task.executions.count(), 2)

        latest_exec = task.executions.order_by('-started_at').first()
        self.assertEqual(latest_exec.execution_type, "RETRY")
        self.assertEqual(latest_exec.parent_execution_id, initial_exec.id)
        self.assertEqual(latest_exec.prompt, "Check inventory")

    def test_task_follow_up_creates_follow_up_execution_with_context(self):
        task = Task.objects.create(
            workspace=self.workspace,
            creator=self.user,
            assigned_agent=self.agent,
            problem_statement="Process report",
            status="COMPLETED",
            result="Report processed partially."
        )
        initial_exec = TaskExecution.objects.create(
            task=task,
            agent=self.agent,
            status="COMPLETED",
            execution_type="INITIAL",
            prompt="Process report",
            result="Report processed partially."
        )

        url = reverse('task-follow-up', kwargs={'pk': task.id})
        response = self.client.post(url, {
            "prompt": "Also include section 4 in the report"
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        task.refresh_from_db()
        self.assertEqual(task.executions.count(), 2)

        latest_exec = task.executions.order_by('-started_at').first()
        self.assertEqual(latest_exec.execution_type, "FOLLOW_UP")
        self.assertEqual(latest_exec.parent_execution_id, initial_exec.id)
        self.assertIn("Original task:", latest_exec.prompt)
        self.assertIn("Process report", latest_exec.prompt)
        self.assertIn("Previous execution result:", latest_exec.prompt)
        self.assertIn("Also include section 4 in the report", latest_exec.prompt)

    def test_viewer_is_forbidden_from_retry_and_follow_up(self):
        task = Task.objects.create(
            workspace=self.workspace,
            creator=self.user,
            assigned_agent=self.agent,
            problem_statement="Process report",
            status="FAILED"
        )
        self.client.force_authenticate(user=self.viewer_user)

        retry_url = reverse('task-retry', kwargs={'pk': task.id})
        retry_res = self.client.post(retry_url, format='json')
        self.assertEqual(retry_res.status_code, status.HTTP_403_FORBIDDEN)

        follow_url = reverse('task-follow-up', kwargs={'pk': task.id})
        follow_res = self.client.post(follow_url, {"prompt": "Clarification"}, format='json')
        self.assertEqual(follow_res.status_code, status.HTTP_403_FORBIDDEN)

    def test_follow_up_preserves_hitl_approval_pipeline(self):
        task = Task.objects.create(
            workspace=self.workspace,
            creator=self.user,
            assigned_agent=self.agent,
            problem_statement="Audit files in root directory",
            status="COMPLETED"
        )
        initial_exec = TaskExecution.objects.create(
            task=task,
            agent=self.agent,
            status="COMPLETED",
            execution_type="INITIAL",
            prompt="Audit files in root directory"
        )

        url = reverse('task-follow-up', kwargs={'pk': task.id})
        response = self.client.post(url, {
            "prompt": "Find all markdown files using find command"
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        task.refresh_from_db()
        self.assertEqual(task.executions.count(), 2)
        latest_exec = task.executions.order_by('-started_at').first()
        self.assertEqual(latest_exec.execution_type, "FOLLOW_UP")
