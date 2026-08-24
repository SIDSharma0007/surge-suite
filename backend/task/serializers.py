from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Agent, Task, TaskExecution, Action, ExecutionEvent, HumanApprovalRequest

class TaskUserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source='first_name', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'name', 'email']


class AgentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Agent
        fields = [
            'id', 'name', 'description', 'provider', 'model', 
            'capabilities', 'status', 'configuration', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

class ExecutionEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExecutionEvent
        fields = ['id', 'event_type', 'timestamp', 'metadata']
        read_only_fields = ['id', 'timestamp']

class ActionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Action
        fields = ['id', 'action_type', 'status', 'input_data', 'output_data', 'created_at', 'completed_at']
        read_only_fields = ['id', 'created_at', 'completed_at']

class TaskExecutionSerializer(serializers.ModelSerializer):
    actions = ActionSerializer(many=True, read_only=True)
    events = ExecutionEventSerializer(many=True, read_only=True)
    agent_details = AgentSerializer(source='agent', read_only=True)

    class Meta:
        model = TaskExecution
        fields = [
            'id', 'status', 'mode', 'started_at', 'completed_at', 
            'result', 'error', 'actions', 'events', 'agent_details',
            'provider', 'model'
        ]
        read_only_fields = ['id', 'started_at', 'completed_at']


class HumanApprovalRequestSerializer(serializers.ModelSerializer):
    """
    Read-only serializer for HumanApprovalRequest.

    SECURITY:
    - `command` (raw) is intentionally EXCLUDED. Only sanitized_display_command is exposed.
    - execution_result is intentionally EXCLUDED to avoid leaking raw output to unauthorized users.
      It is used internally by the execution engine only.
    - resolved_by username is exposed for audit purposes (not the User object).
    """
    resolved_by_username = serializers.SerializerMethodField()
    is_expired = serializers.SerializerMethodField()

    class Meta:
        model = HumanApprovalRequest
        fields = [
            'id',
            'sanitized_display_command',  # secrets-redacted display version
            'reason',
            'risk',
            'status',
            'created_at',
            'expires_at',
            'resolved_at',
            'resolved_by_username',
            'is_expired',
        ]
        read_only_fields = fields

    def get_resolved_by_username(self, obj):
        if obj.resolved_by:
            return obj.resolved_by.username
        return None

    def get_is_expired(self, obj):
        return obj.is_expired()


class TaskSerializer(serializers.ModelSerializer):
    creator = TaskUserSerializer(read_only=True)
    assigned_agent_details = AgentSerializer(source='assigned_agent', read_only=True)
    executions = TaskExecutionSerializer(many=True, read_only=True)
    events = ExecutionEventSerializer(many=True, read_only=True)
    pending_approval = serializers.SerializerMethodField()
    walkthrough = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            'id', 'workspace', 'creator', 'problem_statement', 
            'assigned_agent', 'assigned_agent_details', 'status', 
            'result', 'created_at', 'updated_at', 'executions', 'events',
            'pending_approval', 'walkthrough'
        ]
        read_only_fields = [
            'id', 'creator', 'status', 'result', 'created_at', 'updated_at',
            'executions', 'events', 'pending_approval', 'walkthrough'
        ]

    def get_pending_approval(self, obj):
        """
        Return the single PENDING approval request for this task, if any.
        Only returned when the task is WAITING_FOR_APPROVAL.
        Returns None otherwise.
        """
        if obj.status != 'WAITING_FOR_APPROVAL':
            return None
        approval = obj.approval_requests.filter(status='PENDING').first()
        if not approval:
            return None
        return HumanApprovalRequestSerializer(approval).data

    def get_walkthrough(self, obj):
        import os
        from django.conf import settings
        artifact_path = os.path.join(os.path.dirname(settings.BASE_DIR), '.surge', 'task-artifacts', str(obj.id), 'walkthrough.md')
        if os.path.exists(artifact_path):
            try:
                with open(artifact_path, 'r', encoding='utf-8') as f:
                    return f.read()
            except Exception:
                pass
        return None

    def validate_workspace(self, value):
        user = self.context['request'].user
        # Check membership/ownership on workspace
        if value.owner != user and not value.memberships.filter(user=user).exists():
            raise serializers.ValidationError("You do not have access to this workspace.")
        return value
