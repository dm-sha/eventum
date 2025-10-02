from django.utils.deprecation import MiddlewareMixin
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

class SubdomainMiddleware(MiddlewareMixin):
    """
    Упрощенный middleware для обработки поддоменов (для обратной совместимости).
    Теперь основной способ определения eventum - через URL параметры.
    """
    
    def process_request(self, request):
        """
        Обрабатывает запрос и добавляет eventum_slug в request, если запрос идет с поддомена.
        Используется как fallback для обратной совместимости.
        """
        host = request.META.get('HTTP_HOST', '').lower()
        
        # Определяем базовый домен в зависимости от режима
        if settings.DEBUG:
            base_domains = ['merup.ru', 'localhost:8000', '127.0.0.1:8000']
        else:
            base_domains = ['merup.ru']
        
        # Проверяем каждый базовый домен
        for base_domain in base_domains:
            if host.endswith(f'.{base_domain}'):
                # Извлекаем slug из поддомена
                subdomain = host.replace(f'.{base_domain}', '')
                
                # Проверяем, что это не зарезервированные поддомены
                reserved_subdomains = ['www', 'api', 'admin', 'mail', 'ftp', 'cdn', 'static']
                if subdomain not in reserved_subdomains:
                    # Просто сохраняем slug, не делаем запрос к БД
                    # Проверка существования eventum будет в get_eventum_from_request
                    request.eventum_slug = subdomain
                    logger.debug(f"SubdomainMiddleware: Detected subdomain: {subdomain}")
                break
        
        return None
