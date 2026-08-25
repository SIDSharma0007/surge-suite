from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    TaskViewSet, AgentViewSet, ProviderSettingsView, ProviderSettingsDetailView,
    BuiltinMCPServerListView, UserMCPServerViewSet
)

router = DefaultRouter()
router.register(r'tasks', TaskViewSet, basename='task')
router.register(r'agents', AgentViewSet, basename='agent')
router.register(r'mcp/custom', UserMCPServerViewSet, basename='mcp-custom')

urlpatterns = [
    path('', include(router.urls)),
    path('mcp/builtin/', BuiltinMCPServerListView.as_view(), name='mcp-builtin'),
    path('settings/providers/', ProviderSettingsView.as_view(), name='provider-settings'),
    path('settings/providers/<str:provider>/', ProviderSettingsDetailView.as_view(), name='provider-settings-detail'),
]
