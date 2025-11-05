from rest_framework.authentication import BaseAuthentication
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser

class QueryTokenAuthentication(BaseAuthentication):
    """
    Кастомная аутентификация для Django REST Framework через:
    - Authorization header (Bearer token) - приоритет для wildcard доменов
    - Query параметры (access_token, token)
    - POST данные (access_token, token)
    """
    
    def authenticate(self, request):
        # Получаем токен из различных источников
        token = None
        
        # 1. Из заголовка Authorization (приоритет для wildcard доменов)
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]  # Убираем 'Bearer '
        
        # 2. Из query параметра 'access_token'
        elif 'access_token' in request.GET:
            token = request.GET['access_token']
        
        # 3. Из query параметра 'token' (альтернатива)
        elif 'token' in request.GET:
            token = request.GET['token']
        
        # 4. Из POST данных (для POST запросов)
        elif request.method == 'POST' and hasattr(request, 'data'):
            if 'access_token' in request.data:
                token = request.data['access_token']
            elif 'token' in request.data:
                token = request.data['token']
        
        if not token:
            return None
        
        try:
            # Валидируем JWT токен
            access_token = AccessToken(token)
            user_id = access_token['user_id']
            
            # Получаем пользователя
            User = get_user_model()
            user = User.objects.get(id=user_id)
            return (user, token)
            
        except Exception as e:
            return None
    
    def authenticate_header(self, request):
        return 'Bearer'
