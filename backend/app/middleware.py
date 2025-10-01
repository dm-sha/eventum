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
        logger.info(f"SubdomainMiddleware: Processing request for host: {host}")
        
        # Проверяем, является ли это поддоменом merup.ru
        if host.endswith('.merup.ru'):
            # Извлекаем slug из поддомена
            subdomain = host.replace('.merup.ru', '')
            logger.info(f"SubdomainMiddleware: Detected subdomain: {subdomain}")
            
            # Проверяем, что это не зарезервированные поддомены
            reserved_subdomains = ['www', 'api', 'admin', 'mail', 'ftp']
            if subdomain in reserved_subdomains:
                logger.info(f"SubdomainMiddleware: Reserved subdomain {subdomain}, skipping")
                return None
            
            # Проверяем, существует ли eventum с таким slug
            try:
                eventum = Eventum.objects.get(slug=subdomain)
                # Добавляем eventum_slug в request для использования в views
                request.eventum_slug = subdomain
                request.eventum = eventum
                logger.info(f"SubdomainMiddleware: Поддомен {subdomain} обработан для eventum {eventum.name}")
            except Eventum.DoesNotExist:
                logger.warning(f"SubdomainMiddleware: Eventum с slug {subdomain} не найден")
                # Можно вернуть 404 или продолжить обработку
                # Пока что продолжаем обработку, чтобы не ломать существующую логику
                pass
        else:
            logger.info(f"SubdomainMiddleware: Not a merup.ru subdomain, skipping")
        
        return None
