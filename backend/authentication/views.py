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
        
    record, error_msg = register_face_from_image(
        name=data['name'],
        img=img,
        user_id=data.get('user_id'),
        device_id=data.get('device_id'),
        extra_metadata=data.get('extra_metadata')
    )
    
    if error_msg:
        return Response({"error": error_msg}, status=status.HTTP_400_BAD_REQUEST)
        
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
        response_serializer = AuthSuccessResponseSerializer(result)
        return Response(response_serializer.data, status=status.HTTP_200_OK)
    else:
        response_serializer = AuthFailureResponseSerializer(result)
        return Response(response_serializer.data, status=status.HTTP_200_OK)

@api_view(['GET'])
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
