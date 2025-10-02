from django.utils.deprecation import MiddlewareMixin
from django.http import Http404
from django.conf import settings
from .models import Eventum
import logging

logger = logging.getLogger(__name__)

class SubdomainMiddleware(MiddlewareMixin):
    """
    Улучшенный middleware для обработки поддоменов и определения eventum slug
    """
    
    def process_request(self, request):
        """
        Обрабатывает запрос и добавляет eventum_slug в request, если запрос идет с поддомена
        """
        host = request.META.get('HTTP_HOST', '').lower()
        logger.info(f"SubdomainMiddleware: Processing request for host: {host}")
        
        # Определяем базовый домен в зависимости от режима
        if settings.DEBUG:
            # В режиме разработки поддерживаем localhost с портом
            base_domains = ['merup.ru', 'localhost:8000', '127.0.0.1:8000']
        else:
            base_domains = ['merup.ru']
        
        eventum_slug = None
        
        # Проверяем каждый базовый домен
        for base_domain in base_domains:
            if host.endswith(f'.{base_domain}'):
                # Извлекаем slug из поддомена
                subdomain = host.replace(f'.{base_domain}', '')
                logger.info(f"SubdomainMiddleware: Detected subdomain: {subdomain}")
                
                # Проверяем, что это не зарезервированные поддомены
                reserved_subdomains = ['www', 'api', 'admin', 'mail', 'ftp', 'cdn', 'static']
                if subdomain in reserved_subdomains:
                    logger.info(f"SubdomainMiddleware: Reserved subdomain {subdomain}, skipping")
                    return None
                
                eventum_slug = subdomain
                break
        
        # Если нашли eventum_slug, пробуем найти eventum
        if eventum_slug:
            try:
                eventum = Eventum.objects.select_related().get(slug=eventum_slug)
                # Добавляем eventum_slug и eventum в request для использования в views
                request.eventum_slug = eventum_slug
                request.eventum = eventum
                logger.info(f"SubdomainMiddleware: Поддомен {eventum_slug} обработан для eventum {eventum.name}")
            except Eventum.DoesNotExist:
                logger.warning(f"SubdomainMiddleware: Eventum с slug {eventum_slug} не найден")
                # В продакшене можно вернуть 404, в разработке - продолжаем
                if not settings.DEBUG:
                    # В продакшене возвращаем 404 для несуществующих поддоменов
                    from django.http import Http404
                    raise Http404(f"Eventum with slug '{eventum_slug}' not found")
        else:
            logger.info(f"SubdomainMiddleware: Not a subdomain request for supported domains, skipping")
        
        return None
