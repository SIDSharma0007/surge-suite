from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Workspace, WorkspaceMembership

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name']

class WorkspaceSerializer(serializers.ModelSerializer):
    owner = UserSerializer(read_only=True)
    role = serializers.SerializerMethodField()

    class Meta:
        model = Workspace
        fields = [
            'id', 'name', 'owner', 'role', 'is_archived', 
            'created_at', 'updated_at', 'archived_at', 'scheduled_deletion_at'
        ]
        read_only_fields = [
            'id', 'owner', 'role', 'is_archived', 
            'created_at', 'updated_at', 'archived_at', 'scheduled_deletion_at'
        ]

    def get_role(self, obj):
        request = self.context.get('request')
        if request and request.user:
            if obj.owner == request.user:
                return 'OWNER'
            membership = obj.memberships.filter(user=request.user).first()
            if membership:
                return membership.role
        return None

class WorkspaceMembershipSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source='user', write_only=True
    )

    class Meta:
        model = WorkspaceMembership
        fields = ['id', 'user', 'user_id', 'role', 'created_at']
        read_only_fields = ['id', 'role', 'created_at']
