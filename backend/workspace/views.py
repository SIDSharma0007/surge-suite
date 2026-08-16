from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth.models import User

from .models import Workspace, WorkspaceMembership
from .serializers import WorkspaceSerializer, WorkspaceMembershipSerializer
from .permissions import IsWorkspaceOwner, IsWorkspaceMember, IsAuthenticatedOr401

class WorkspaceViewSet(viewsets.ModelViewSet):
    queryset = Workspace.objects.all()
    serializer_class = WorkspaceSerializer
    permission_classes = [IsAuthenticatedOr401]

    def get_queryset(self):
        # Return only workspaces where user is owner or member, and not archived
        user = self.request.user
        queryset = Workspace.objects.filter(
            owner=user
        ) | Workspace.objects.filter(
            memberships__user=user
        )
        # Exclude archived from normal list
        return queryset.filter(is_archived=False).distinct()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user

        # Concurrency control: select_for_update to lock user row
        try:
            with transaction.atomic():
                User.objects.select_for_update().get(id=user.id)
                # Count all workspaces owned by the user (including archived ones)
                owned_count = Workspace.objects.filter(owner=user).count()
                if owned_count >= 5:
                    return Response(
                        {"error": "You have reached the maximum limit of 5 owned workspaces (including archived ones)."},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Save workspace
                workspace = Workspace.objects.create(
                    name=serializer.validated_data['name'],
                    owner=user
                )
        except Exception as e:
            return Response(
                {"error": f"Workspace creation failed: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        response_serializer = self.get_serializer(workspace)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, *args, **kwargs):
        # We need to perform the retrieve with custom permissions
        instance = get_object_or_404(Workspace, pk=kwargs.get('pk'))
        
        # Check permissions manually to support 403 and 404 precisely
        self.check_object_permissions(request, instance)

        if instance.is_archived:
            return Response(
                {"error": "This workspace has been archived and cannot be normally accessed."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        instance = get_object_or_404(Workspace, pk=kwargs.get('pk'))
        self.check_object_permissions(request, instance)

        if instance.is_archived:
            return Response(
                {"error": "Cannot update an archived workspace."},
                status=status.HTTP_403_FORBIDDEN
            )

        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        # Destructive delete is blocked
        return Response(
            {"error": "Workspaces cannot be deleted directly. Use the archive endpoint instead."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED
        )

    def get_permissions(self):
        # Determine permission based on action
        if self.action in ['retrieve']:
            return [IsAuthenticatedOr401(), IsWorkspaceMember()]
        elif self.action in ['update', 'partial_update', 'destroy', 'archive', 'restore', 'list_members', 'add_member', 'remove_member']:
            return [IsAuthenticatedOr401(), IsWorkspaceOwner()]
        return [IsAuthenticatedOr401()]

    # --- Archival & Restoration Actions ---

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticatedOr401, IsWorkspaceOwner])
    def archive(self, request, pk=None):
        workspace = get_object_or_404(Workspace, pk=pk)
        self.check_object_permissions(request, workspace)
        if workspace.is_archived:
            return Response(
                {"error": "Workspace is already archived."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        now = timezone.now()
        workspace.is_archived = True
        workspace.archived_at = now
        workspace.scheduled_deletion_at = now + timedelta(days=30)
        workspace.save()

        serializer = self.get_serializer(workspace)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticatedOr401, IsWorkspaceOwner])
    def restore(self, request, pk=None):
        workspace = get_object_or_404(Workspace, pk=pk)
        self.check_object_permissions(request, workspace)

        # Check deadline before restoring
        if workspace.scheduled_deletion_at and workspace.scheduled_deletion_at <= timezone.now():
            return Response(
                {"error": "This workspace has passed the 30-day recovery deadline and cannot be restored."},
                status=status.HTTP_404_NOT_FOUND
            )

        if not workspace.is_archived:
            return Response(
                {"error": "Workspace is not archived."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        workspace.is_archived = False
        workspace.archived_at = None
        workspace.scheduled_deletion_at = None
        workspace.save()

        serializer = self.get_serializer(workspace)
        return Response(serializer.data, status=status.HTTP_200_OK)

    # --- Membership Management Actions ---

    @action(detail=False, methods=['get'], url_path='archived', permission_classes=[IsAuthenticatedOr401])
    def list_archived_workspaces(self, request):
        queryset = Workspace.objects.filter(
            owner=request.user,
            is_archived=True
        )
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='users', permission_classes=[IsAuthenticatedOr401])
    def list_all_users(self, request):
        users = User.objects.exclude(id=request.user.id)
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='members', permission_classes=[IsAuthenticatedOr401, IsWorkspaceOwner])
    def list_members(self, request, pk=None):
        workspace = self.get_object()
        memberships = workspace.memberships.all()
        serializer = WorkspaceMembershipSerializer(memberships, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='members', permission_classes=[IsAuthenticatedOr401, IsWorkspaceOwner])
    def add_member(self, request, pk=None):
        workspace = self.get_object()
        serializer = WorkspaceMembershipSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']

        if user == workspace.owner:
            return Response(
                {"error": "Workspace owner cannot be added as a member."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if WorkspaceMembership.objects.filter(workspace=workspace, user=user).exists():
            return Response(
                {"error": "User is already a member of this workspace."},
                status=status.HTTP_400_BAD_REQUEST
            )

        membership = WorkspaceMembership.objects.create(
            workspace=workspace,
            user=user,
            role='MEMBER'
        )

        response_serializer = WorkspaceMembershipSerializer(membership)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path='members/(?P<user_id>[^/.]+)', permission_classes=[IsAuthenticatedOr401, IsWorkspaceOwner])
    def remove_member(self, request, pk=None, user_id=None):
        workspace = self.get_object()
        membership = get_object_or_404(WorkspaceMembership, workspace=workspace, user_id=user_id)
        membership.delete()
        return Response({"success": True, "message": "Member removed successfully."}, status=status.HTTP_200_OK)
