from django.urls import path
from .views import register_face_api, verify_face_api, status_api

urlpatterns = [
    path('register/', register_face_api, name='register-face-api'),
    path('verify/', verify_face_api, name='verify-face-api'),
    path('status/', status_api, name='status-api'),
]
