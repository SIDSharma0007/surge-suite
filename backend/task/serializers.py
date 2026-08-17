from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Agent, Task, TaskExecution, Action, ExecutionEvent

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
            'result', 'error', 'actions', 'events', 'agent_details'
        ]
        read_only_fields = ['id', 'started_at', 'completed_at']

class TaskSerializer(serializers.ModelSerializer):
    creator = TaskUserSerializer(read_only=True)
    assigned_agent_details = AgentSerializer(source='assigned_agent', read_only=True)
    executions = TaskExecutionSerializer(many=True, read_only=True)
    events = ExecutionEventSerializer(many=True, read_only=True)

    class Meta:
        model = Task
        fields = [
            'id', 'workspace', 'creator', 'problem_statement', 
            'assigned_agent', 'assigned_agent_details', 'status', 
            'result', 'created_at', 'updated_at', 'executions', 'events'
        ]
        read_only_fields = ['id', 'creator', 'status', 'result', 'created_at', 'updated_at', 'executions', 'events']

    def validate_workspace(self, value):
        user = self.context['request'].user
        # Check membership/ownership on workspace
        if value.owner != user and not value.memberships.filter(user=user).exists():
            raise serializers.ValidationError("You do not have access to this workspace.")
        return value
