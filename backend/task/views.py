from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from workspace.models import Workspace
from workspace.permissions import IsAuthenticatedOr401
from .models import Task, Agent, TaskExecution
from .serializers import TaskSerializer, AgentSerializer, TaskExecutionSerializer
from .permissions import IsWorkspaceMemberForTask
from .services.task_service import TaskService
from .services.execution_service import ExecutionService

class AgentViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for viewing active agents.
    """
    queryset = Agent.objects.filter(status='ACTIVE')
    serializer_class = AgentSerializer
    permission_classes = [permissions.IsAuthenticated]

class TaskViewSet(viewsets.ModelViewSet):
    """
    API endpoints for listing, creating, and executing workspace tasks.
    """
    queryset = Task.objects.all()
    serializer_class = TaskSerializer
    permission_classes = [IsWorkspaceMemberForTask]

    def get_queryset(self):
        user = self.request.user
        workspace_id = self.request.query_params.get('workspace')
        
        # Enforce that query workspace is provided
        if not workspace_id:
            return Task.objects.none()

        workspace = get_object_or_404(Workspace, id=workspace_id)
        
        # Check permissions: user must be owner or member
        if workspace.owner != user and not workspace.memberships.filter(user=user).exists():
            return Task.objects.none()

        return Task.objects.filter(workspace=workspace).order_by('-created_at')

    def create(self, request, *args, **kwargs):
        # We override create to invoke the TaskService
        workspace_id = request.data.get('workspace')
        problem_statement = request.data.get('problem_statement')

        if not workspace_id or not problem_statement:
            return Response(
                {"error": "Both workspace and problem_statement fields are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        workspace = get_object_or_404(Workspace, id=workspace_id)
        
        # Enforce workspace access check
        self.check_object_permissions(request, workspace)

        task_service = TaskService()
        task = task_service.create_task(
            workspace=workspace,
            creator=request.user,
            problem_statement=problem_statement
        )

        serializer = self.get_serializer(task)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, *args, **kwargs):
        task = get_object_or_404(Task, id=kwargs.get('pk'))
        self.check_object_permissions(request, task)
        serializer = self.get_serializer(task)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def update(self, request, *args, **kwargs):
        return Response(
            {"error": "Direct updates to tasks are not allowed."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED
        )

    def destroy(self, request, *args, **kwargs):
        return Response(
            {"error": "Task deletion is not allowed."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED
        )

    @action(detail=True, methods=['post'], permission_classes=[IsWorkspaceMemberForTask])
    def execute(self, request, pk=None):
        task = get_object_or_404(Task, id=pk)
        self.check_object_permissions(request, task)

        if task.status == 'RUNNING':
            return Response(
                {"error": "Task is already executing."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Execute synchronously using service layer
        execution_service = ExecutionService()
        execution = execution_service.execute_task(task, user=request.user)

        # Refresh task from DB to pick up latest state
        task.refresh_from_db()
        serializer = self.get_serializer(task)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], permission_classes=[IsWorkspaceMemberForTask])
    def walkthrough(self, request, pk=None):
        import os
        from django.conf import settings
        from django.http import HttpResponse
        task = get_object_or_404(Task, id=pk)
        self.check_object_permissions(request, task)

        artifact_path = os.path.join(os.path.dirname(settings.BASE_DIR), '.surge', 'task-artifacts', str(task.id), 'walkthrough.md')
        if not os.path.exists(artifact_path):
            return Response(
                {"error": "Walkthrough artifact has not been generated for this task."},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            with open(artifact_path, 'r', encoding='utf-8') as f:
                content = f.read()

            if request.query_params.get('download') == 'true':
                response = HttpResponse(content, content_type='text/markdown')
                response['Content-Disposition'] = f'attachment; filename="walkthrough-{str(task.id)[:8]}.md"'
                return response

            return Response({
                "task_id": str(task.id),
                "filename": "walkthrough.md",
                "content": content
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {"error": f"Failed to read walkthrough artifact: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(
        detail=True,
        methods=['post'],
        permission_classes=[IsWorkspaceMemberForTask],
        url_path=r'approvals/(?P<approval_id>[0-9a-f-]+)/approve'
    )
    def approve_command(self, request, pk=None, approval_id=None):
        """
        Phase 4.7: Approve a pending shell command authorization request.

        POST /tasks/{task_id}/approvals/{approval_id}/approve/

        The command is re-classified immediately before execution.
        BLOCKED commands cannot be approved even via this endpoint.
        """
        from .services.approval_service import ApprovalService, ApprovalValidationError

        task = get_object_or_404(Task, id=pk)
        self.check_object_permissions(request, task)

        if task.status != 'WAITING_FOR_APPROVAL':
            return Response(
                {"error": f"Task is not waiting for approval (current status: {task.status})."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not approval_id:
            return Response(
                {"error": "approval_id is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            approval_service = ApprovalService()
            approval_service.resolve_approve(
                approval_id=approval_id,
                task_id=str(pk),
                resolving_user=request.user
            )
        except ApprovalValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response(
                {"error": f"Approval processing failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        task.refresh_from_db()
        serializer = self.get_serializer(task)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(
        detail=True,
        methods=['post'],
        permission_classes=[IsWorkspaceMemberForTask],
        url_path=r'approvals/(?P<approval_id>[0-9a-f-]+)/deny'
    )
    def deny_command(self, request, pk=None, approval_id=None):
        """
        Phase 4.7: Deny a pending shell command authorization request.

        POST /tasks/{task_id}/approvals/{approval_id}/deny/

        The command is NEVER executed after denial.
        The agent receives explicit denial feedback and adapts its response.
        """
        from .services.approval_service import ApprovalService, ApprovalValidationError

        task = get_object_or_404(Task, id=pk)
        self.check_object_permissions(request, task)

        if task.status != 'WAITING_FOR_APPROVAL':
            return Response(
                {"error": f"Task is not waiting for approval (current status: {task.status})."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not approval_id:
            return Response(
                {"error": "approval_id is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            approval_service = ApprovalService()
            approval_service.resolve_deny(
                approval_id=approval_id,
                task_id=str(pk),
                resolving_user=request.user
            )
        except ApprovalValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response(
                {"error": f"Denial processing failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        task.refresh_from_db()
        serializer = self.get_serializer(task)
        return Response(serializer.data, status=status.HTTP_200_OK)

from rest_framework.views import APIView
from django.db import transaction
from .models import UserProviderCredential
from .utils.encryption import encrypt_value, decrypt_value

SUPPORTED_PROVIDERS = {
    "openclaw": "OpenClaw",
    "opencode": "OpenCode",
    "groq": "Groq",
    "nvidia_nim": "NVIDIA NIM",
    "gemini": "Google AI Studio",
}

class ProviderSettingsView(APIView):
    permission_classes = [IsAuthenticatedOr401]

    def get(self, request):
        user = request.user
        credentials = {
            c.provider: decrypt_value(c.encrypted_api_key)
            for c in UserProviderCredential.objects.filter(user=user)
        }
        
        response_data = []
        for p_id, p_name in SUPPORTED_PROVIDERS.items():
            key = credentials.get(p_id)
            configured = bool(key)
            masked = "••••••••" + key[-4:] if (key and len(key) >= 4) else ("••••" if key else None)
            response_data.append({
                "provider": p_id,
                "configured": configured,
                "masked_key": masked
            })
        return Response(response_data, status=status.HTTP_200_OK)

class ProviderSettingsDetailView(APIView):
    permission_classes = [IsAuthenticatedOr401]

    def post(self, request, provider):
        return self._save_key(request, provider)

    def put(self, request, provider):
        return self._save_key(request, provider)

    def _save_key(self, request, provider):
        provider = provider.lower()
        if provider not in SUPPORTED_PROVIDERS:
            return Response(
                {"error": f"Unsupported provider: '{provider}'"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        api_key = request.data.get("api_key")
        if not api_key:
            return Response(
                {"error": "api_key field is required."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user = request.user
        encrypted = encrypt_value(api_key)
        
        # Save or update credential atomically
        with transaction.atomic():
            cred, created = UserProviderCredential.objects.get_or_create(
                user=user,
                provider=provider,
                defaults={"encrypted_api_key": encrypted}
            )
            if not created:
                cred.encrypted_api_key = encrypted
                cred.save()
                
        # Return masked key
        masked = "••••••••" + api_key[-4:] if len(api_key) >= 4 else "••••"
        return Response({
            "provider": provider,
            "configured": True,
            "masked_key": masked
        }, status=status.HTTP_200_OK)

    def delete(self, request, provider):
        provider = provider.lower()
        if provider not in SUPPORTED_PROVIDERS:
            return Response(
                {"error": f"Unsupported provider: '{provider}'"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user = request.user
        deleted_count, _ = UserProviderCredential.objects.filter(user=user, provider=provider).delete()
        
        return Response({
            "provider": provider,
            "configured": False,
            "masked_key": None
        }, status=status.HTTP_200_OK)
