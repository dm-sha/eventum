from rest_framework.authentication import BaseAuthentication
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
import logging

logger = logging.getLogger(__name__)

class QueryTokenAuthentication(BaseAuthentication):
    """
    Кастомная аутентификация для Django REST Framework через query параметры
    """
    
    def authenticate(self, request):
        # Получаем токен из query параметров
        token = None
        
        # 1. Из query параметра 'access_token' (приоритет)
        if 'access_token' in request.GET:
            token = request.GET['access_token']
            logger.info(f"QueryTokenAuthentication: Token found in access_token query parameter")
        
        # 2. Из query параметра 'token' (альтернатива)
        elif 'token' in request.GET:
            token = request.GET['token']
            logger.info(f"QueryTokenAuthentication: Token found in token query parameter")
        
        # 3. Из POST данных (для POST запросов)
        elif request.method == 'POST' and hasattr(request, 'data'):
            if 'access_token' in request.data:
                token = request.data['access_token']
                logger.info(f"QueryTokenAuthentication: Token found in POST data access_token")
            elif 'token' in request.data:
                token = request.data['token']
                logger.info(f"QueryTokenAuthentication: Token found in POST data token")
        
        if not token:
            logger.info("QueryTokenAuthentication: No token found")
            return None
        
        try:
            # Валидируем JWT токен
            access_token = AccessToken(token)
            user_id = access_token['user_id']
            
            # Получаем пользователя
            User = get_user_model()
            user = User.objects.get(id=user_id)
            
            logger.info(f"QueryTokenAuthentication: User authenticated: {user.name} (ID: {user.id})")
            return (user, token)
            
        except Exception as e:
            logger.error(f"QueryTokenAuthentication: Token validation error: {e}")
            return None
    
    def authenticate_header(self, request):
        return 'Bearer'
