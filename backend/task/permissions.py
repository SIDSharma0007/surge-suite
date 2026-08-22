from rest_framework import permissions
from workspace.permissions import Explicit401Exception

class IsWorkspaceMemberForTask(permissions.BasePermission):
    """
    Enforces that the user has access to the workspace associated with the task.
    """
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            raise Explicit401Exception()
        return True

    def has_object_permission(self, request, view, obj):
        # obj can be a Workspace or a Task
        workspace = obj
        if hasattr(obj, 'workspace'):
            workspace = obj.workspace

        # Check membership/ownership on workspace
        if workspace.owner == request.user:
            return True
        return workspace.memberships.filter(user=request.user).exists()
