from rest_framework import serializers

# ==========================
# Input Validation Serializers
# ==========================

class RegisterRequestSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255, required=True)
    image = serializers.CharField(required=True, help_text="Base64 encoded image string")
    user_id = serializers.CharField(max_length=255, required=False, allow_null=True, allow_blank=True)
    device_id = serializers.CharField(max_length=255, required=False, allow_null=True, allow_blank=True)
    extra_metadata = serializers.JSONField(required=False, default=dict)

class VerifyRequestSerializer(serializers.Serializer):
    image = serializers.CharField(required=True, help_text="Base64 encoded image string")
    device_id = serializers.CharField(max_length=255, required=False, allow_null=True, allow_blank=True)


# ==========================
# Output Response Serializers
# ==========================

class UserSerializer(serializers.Serializer):
    id = serializers.CharField(source='user_id')
    name = serializers.CharField()

class AuthSuccessResponseSerializer(serializers.Serializer):
    authenticated = serializers.BooleanField(default=True)
    user = UserSerializer()

class AuthFailureResponseSerializer(serializers.Serializer):
    authenticated = serializers.BooleanField(default=False)
    reason = serializers.CharField()

class RegisterResponseSerializer(serializers.Serializer):
    user_id = serializers.CharField()
    name = serializers.CharField()
    created_at = serializers.CharField()
    device_id = serializers.CharField()
    active = serializers.BooleanField()

class StatusResponseSerializer(serializers.Serializer):
    status = serializers.CharField()
    registered_faces_count = serializers.IntegerField()
