import logging
from django.utils.deprecation import MiddlewareMixin
from django.http import JsonResponse

logger = logging.getLogger(__name__)

class CORSFixMiddleware(MiddlewareMixin):
    """
    Middleware для исправления проблем с CORS и заголовком Authorization
    """
    
    def process_response(self, request, response):
        # Добавляем CORS заголовки для всех API запросов
        if request.path.startswith('/api/'):
            origin = request.META.get('HTTP_ORIGIN', '')
            
            # Разрешаем только определенные домены
            allowed_origins = [
                'http://localhost:5173',
                'http://localhost:5174', 
                'https://eventum-web-ui.vercel.app',
                'https://bbapo5ibqs4eg6dail89.containers.yandexcloud.net'
            ]
            
            if origin in allowed_origins:
                response['Access-Control-Allow-Origin'] = origin
                response['Access-Control-Allow-Credentials'] = 'true'
                response['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
                response['Access-Control-Allow-Headers'] = 'accept, accept-encoding, authorization, Authorization, content-type, dnt, origin, user-agent, x-csrftoken, x-requested-with'
                response['Access-Control-Expose-Headers'] = 'Authorization, authorization'
                
                logger.info(f"CORS headers added for origin: {origin}")
        
        return response

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
                access_control_request_method = request.META.get('HTTP_ACCESS_CONTROL_REQUEST_METHOD', '')
                logger.info(f"Access-Control-Request-Headers: {access_control_request_headers}")
                logger.info(f"Access-Control-Request-Method: {access_control_request_method}")
                
                # Проверяем, запрашивается ли заголовок Authorization
                if 'authorization' in access_control_request_headers.lower():
                    logger.info("Authorization header requested in preflight")
                else:
                    logger.warning("Authorization header NOT requested in preflight!")
                    logger.warning("This means the browser is not sending Authorization header!")
            
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