from django.urls import path
from .views import status_check

urlpatterns = [
    path('status/', status_check, name='status-check'),
]
