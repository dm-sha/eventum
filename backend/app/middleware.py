from django.utils.deprecation import MiddlewareMixin


class CORSFixMiddleware(MiddlewareMixin):
    """
    Middleware для обработки CORS
    """
    
    def process_response(self, request, response):
        if request.path.startswith('/api/'):
            origin = request.META.get('HTTP_ORIGIN', '')
            
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
                response['Access-Control-Allow-Headers'] = 'accept, accept-encoding, content-type, dnt, origin, user-agent, x-csrftoken, x-requested-with'
                response['Access-Control-Expose-Headers'] = 'Authorization, authorization'
                
                if request.method == 'OPTIONS':
                    response.status_code = 200
        
        return response