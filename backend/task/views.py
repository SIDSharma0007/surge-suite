from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from workspace.models import Workspace
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
        execution = execution_service.execute_task(task)

        # Refresh task from DB to pick up latest state
        task.refresh_from_db()
        serializer = self.get_serializer(task)
        return Response(serializer.data, status=status.HTTP_200_OK)
