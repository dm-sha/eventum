from django.utils.deprecation import MiddlewareMixin
from django.http import Http404
from .models import Eventum
import logging

logger = logging.getLogger(__name__)

class SubdomainMiddleware(MiddlewareMixin):
    """
    Middleware для обработки поддоменов и определения eventum slug
    """
    
    def process_request(self, request):
        """
        Обрабатывает запрос и добавляет eventum_slug в request, если запрос идет с поддомена
        """
        host = request.META.get('HTTP_HOST', '').lower()
        
        # Проверяем, является ли это поддоменом merup.ru
        if host.endswith('.merup.ru'):
            # Извлекаем slug из поддомена
            subdomain = host.replace('.merup.ru', '')
            
            # Проверяем, что это не зарезервированные поддомены
            reserved_subdomains = ['www', 'api', 'admin', 'mail', 'ftp']
            if subdomain in reserved_subdomains:
                return None
            
            # Проверяем, существует ли eventum с таким slug
            try:
                eventum = Eventum.objects.get(slug=subdomain)
                # Добавляем eventum_slug в request для использования в views
                request.eventum_slug = subdomain
                request.eventum = eventum
                logger.info(f"Поддомен {subdomain} обработан для eventum {eventum.name}")
            except Eventum.DoesNotExist:
                logger.warning(f"Eventum с slug {subdomain} не найден")
                # Можно вернуть 404 или продолжить обработку
                # Пока что продолжаем обработку, чтобы не ломать существующую логику
                pass
        
        return None
