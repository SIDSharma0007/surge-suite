from django.http import JsonResponse
from rest_framework.decorators import api_view

# Create your views here.

@api_view(['GET'])
def status_check(request):
    return JsonResponse({
        "status": "online",
        "service": "Surge Suite API",
        "version": "1.0.0"
    })
