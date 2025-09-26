import logging
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger(__name__)

class AuthDebugMiddleware(MiddlewareMixin):
    """
    Middleware для отладки проблем с аутентификацией в продакшене
    """
    
    def process_request(self, request):
        # Логируем только API запросы
        if request.path.startswith('/api/'):
            auth_header = request.META.get('HTTP_AUTHORIZATION', '')
            user = getattr(request, 'user', None)
            
            logger.info(f"API Request: {request.method} {request.path}")
            logger.info(f"Auth Header: {auth_header[:50]}..." if auth_header else "No Auth Header")
            logger.info(f"User: {user} (authenticated: {user.is_authenticated if user else False})")
            
            # Логируем заголовки CORS
            origin = request.META.get('HTTP_ORIGIN', '')
            logger.info(f"Origin: {origin}")
            
            # Специальная обработка для OPTIONS запросов (CORS preflight)
            if request.method == 'OPTIONS':
                logger.info("CORS preflight request detected")
                access_control_request_headers = request.META.get('HTTP_ACCESS_CONTROL_REQUEST_HEADERS', '')
                logger.info(f"Access-Control-Request-Headers: {access_control_request_headers}")
            
            # Логируем все заголовки для отладки
            logger.info(f"All headers: {dict(request.META)}")
            
            # Дополнительная отладка для JWT
            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header[7:]  # Убираем "Bearer "
                logger.info(f"JWT Token: {token[:50]}...")
                
                # Проверяем, что происходит с токеном
                try:
                    from rest_framework_simplejwt.tokens import AccessToken
                    access_token = AccessToken(token)
                    logger.info(f"JWT Token valid: user_id={access_token['user_id']}")
                except Exception as e:
                    logger.error(f"JWT Token validation error: {e}")
            
        return None
    
    def process_response(self, request, response):
        # Логируем только API ответы с ошибками
        if request.path.startswith('/api/') and response.status_code >= 400:
            logger.warning(f"API Error Response: {response.status_code} for {request.method} {request.path}")
            logger.warning(f"Response content: {response.content.decode('utf-8')[:200]}...")
            
        return response