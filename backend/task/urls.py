from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TaskViewSet, AgentViewSet

router = DefaultRouter()
router.register(r'tasks', TaskViewSet, basename='task')
router.register(r'agents', AgentViewSet, basename='agent')

urlpatterns = [
    path('', include(router.urls)),
]
