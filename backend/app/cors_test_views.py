from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.views.decorators.csrf import csrf_exempt
import logging

logger = logging.getLogger(__name__)

@csrf_exempt
@api_view(['GET', 'POST', 'OPTIONS'])
@permission_classes([AllowAny])
def cors_test_view(request):
    """
    Простой view для тестирования CORS
    """
    logger.info(f"CORS Test: {request.method} request from {request.META.get('HTTP_ORIGIN', 'Unknown')}")
    logger.info(f"Headers: {dict(request.META)}")
    
    if request.method == 'OPTIONS':
        # Preflight запрос
        return Response({
            'message': 'CORS preflight successful',
            'method': request.method,
            'origin': request.META.get('HTTP_ORIGIN', 'Unknown')
        }, status=status.HTTP_200_OK)
    
    elif request.method == 'POST':
        # POST запрос
        return Response({
            'message': 'CORS POST successful',
            'method': request.method,
            'data': request.data,
            'origin': request.META.get('HTTP_ORIGIN', 'Unknown')
        }, status=status.HTTP_200_OK)
    
    else:
        # GET запрос
        return Response({
            'message': 'CORS GET successful',
            'method': request.method,
            'origin': request.META.get('HTTP_ORIGIN', 'Unknown')
        }, status=status.HTTP_200_OK)
