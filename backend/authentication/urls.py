from django.urls import path
from .views import register_face_api, verify_face_api, status_api, logout_api, me_api

urlpatterns = [
    path('register/', register_face_api, name='register-face-api'),
    path('verify/', verify_face_api, name='verify-face-api'),
    path('status/', status_api, name='status-api'),
    path('logout/', logout_api, name='logout-api'),
    path('me/', me_api, name='me-api'),
]
