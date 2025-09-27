import logging

logger = logging.getLogger(__name__)

class CorsDebugMiddleware:
    """
    Middleware для отладки CORS проблем
    """
    
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Логируем входящий запрос
        logger.info(f"CORS Debug: {request.method} {request.path}")
        logger.info(f"Origin: {request.META.get('HTTP_ORIGIN', 'None')}")
        logger.info(f"Headers: {dict(request.META)}")
        
        response = self.get_response(request)
        
        # Логируем исходящий ответ
        logger.info(f"Response status: {response.status_code}")
        logger.info(f"Response headers: {dict(response.headers)}")
        
        return response
