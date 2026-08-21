from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

from .utils import decode_base64_image
from .serializers import (
    RegisterRequestSerializer,
    VerifyRequestSerializer,
    AuthSuccessResponseSerializer,
    AuthFailureResponseSerializer,
    RegisterResponseSerializer,
    StatusResponseSerializer
)
from .services.auth_service import register_face_from_image, verify_face_from_image
from .services.registration import load_all_faces

@api_view(['POST'])
def register_face_api(request):
    """
    POST /api/v1/auth/register/
    """
    serializer = RegisterRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
    data = serializer.validated_data
    img = decode_base64_image(data['image'])
    
    if img is None:
        return Response({"error": "Invalid base64 image data."}, status=status.HTTP_400_BAD_REQUEST)
        
    # Generate unique stable UUID for username
    import uuid
    from django.contrib.auth.models import User
    from django.db import transaction
    from workspace.models import Workspace
    user_id = data.get('user_id') or f"user_{uuid.uuid4().hex}"
    
    # Create Django User + Default Workspace atomically (canonical identity and storage)
    try:
        with transaction.atomic():
            django_user = User.objects.create(
                username=user_id,
                first_name=data['name']
            )
            Workspace.objects.create(
                name=f"{django_user.first_name}'s Workspace" if django_user.first_name else "Personal Workspace",
                owner=django_user
            )
    except Exception as e:
        return Response({"error": f"Failed to create canonical user and workspace: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
    # Persist in biometric database
    try:
        record, error_msg = register_face_from_image(
            name=data['name'],
            img=img,
            user_id=user_id,
            device_id=data.get('device_id'),
            extra_metadata=data.get('extra_metadata')
        )
        if error_msg:
            # Rollback newly-created Django User (cascades to Workspace)
            django_user.delete()
            return Response({"error": error_msg}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        # Rollback newly-created Django User (cascades to Workspace)
        django_user.delete()
        return Response({"error": f"Biometric registration failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
    from django.contrib.auth import login as django_login
    django_login(request, django_user)

    response_serializer = RegisterResponseSerializer(record)
    return Response(response_serializer.data, status=status.HTTP_201_CREATED)

@api_view(['POST'])
def verify_face_api(request):
    """
    POST /api/v1/auth/verify/
    """
    serializer = VerifyRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
    data = serializer.validated_data
    img = decode_base64_image(data['image'])
    
    if img is None:
        response_serializer = AuthFailureResponseSerializer({
            "authenticated": False,
            "reason": "Invalid base64 image data."
        })
        return Response(response_serializer.data, status=status.HTTP_400_BAD_REQUEST)
        
    result = verify_face_from_image(img, device_id=data.get('device_id'))
    
    if result["authenticated"]:
        from django.contrib.auth.models import User
        from django.contrib.auth import login as django_login
        from workspace.models import Workspace
        
        user_id = result["user"]["user_id"]
        try:
            # Resolves identity: match biometric user_id to exact Django User.username
            django_user = User.objects.get(username=user_id)
            django_login(request, django_user)
            
            # Ensure the user has at least one owned workspace (heal if legacy)
            if not Workspace.objects.filter(owner=django_user).exists():
                Workspace.objects.create(
                    name=f"{django_user.first_name}'s Workspace" if django_user.first_name else "Personal Workspace",
                    owner=django_user
                )

            # Make sure we use Django User details in returned JSON
            result["user"]["user_id"] = django_user.username
            result["user"]["name"] = django_user.first_name or django_user.username
            
            response_serializer = AuthSuccessResponseSerializer(result)
            return Response(response_serializer.data, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            # Explicit unlinked legacy profile
            response_serializer = AuthFailureResponseSerializer({
                "authenticated": False,
                "reason": "Unlinked legacy profile. This biometric identity is not associated with a canonical application user."
            })
            return Response(response_serializer.data, status=status.HTTP_200_OK)
    else:
        response_serializer = AuthFailureResponseSerializer(result)
        return Response(response_serializer.data, status=status.HTTP_200_OK)

@api_view(['GET'])
@ensure_csrf_cookie
def status_api(request):
    """
    GET /api/v1/auth/status/
    """
    try:
        registered_count = len(load_all_faces())
        state = {
            "status": "online",
            "registered_faces_count": registered_count
        }
    except Exception:
        state = {
            "status": "degraded",
            "registered_faces_count": 0
        }
        
    response_serializer = StatusResponseSerializer(state)
    return Response(response_serializer.data, status=status.HTTP_200_OK)

@api_view(['POST'])
def logout_api(request):
    """
    POST /api/v1/auth/logout/
    """
    from django.contrib.auth import logout as django_logout
    django_logout(request)
    return Response({"success": True, "message": "Logged out successfully"})

@api_view(['GET'])
def me_api(request):
    """
    GET /api/v1/auth/me/
    """
    if not request.user.is_authenticated:
        return Response({"authenticated": False, "error": "Not authenticated"}, status=status.HTTP_401_UNAUTHORIZED)
        
    return Response({
        "authenticated": True,
        "user": {
            "user_id": request.user.username,
            "name": request.user.first_name or request.user.username,
        }
    })

@api_view(['POST', 'GET'])
def dev_login_api(request):
    """
    POST /api/v1/auth/dev-login/
    Development convenience login to start a Django session.
    """
    from django.contrib.auth import login as django_login
    from django.contrib.auth.models import User
    from workspace.models import Workspace

    user = User.objects.first()
    if not user:
        user = User.objects.create(username='dev_user', first_name='Developer')
        Workspace.objects.create(name="Developer's Workspace", owner=user)
    
    django_login(request, user)
    return Response({
        "authenticated": True,
        "user": {
            "user_id": user.username,
            "name": user.first_name or user.username,
        }
    })

