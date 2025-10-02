"""
Базовые классы для ViewSets с улучшенной авторизацией
"""
from rest_framework import viewsets
from django.core.cache import cache
from .auth_utils import EventumMixin, CacheInvalidationMixin


class EventumScopedViewSet(EventumMixin, CacheInvalidationMixin, viewsets.ModelViewSet):
    """
    Базовый ViewSet для работы с объектами, привязанными к eventum
    """
    
    def get_queryset(self):
        """Фильтрует queryset по eventum"""
        eventum = self.get_eventum()
        return self.queryset.filter(eventum=eventum)
    
    def perform_create(self, serializer):
        """Автоматически привязывает создаваемый объект к eventum"""
        eventum = self.get_eventum()
        serializer.save(eventum=eventum)
        # Инвалидация кэша происходит в CacheInvalidationMixin
    
    def get_serializer_context(self):
        """Добавляет eventum в контекст сериализатора"""
        context = super().get_serializer_context()
        context['eventum'] = self.get_eventum()
        context['user_role'] = self.get_user_role()
        return context


class CachedListMixin:
    """
    Миксин для кэширования списков объектов
    """
    cache_timeout = 300  # 5 минут по умолчанию
    
    def get_cache_key(self):
        """Генерирует ключ кэша для списка"""
        eventum = self.get_eventum()
        model_name = self.queryset.model._meta.model_name
        return f"{model_name}_list_{eventum.slug}"
    
    def list(self, request, *args, **kwargs):
        """Переопределяем list для добавления кэширования"""
        # Для пагинированных запросов не используем кэширование
        if request.GET.get('page'):
            return super().list(request, *args, **kwargs)
        
        cache_key = self.get_cache_key()
        
        # Пытаемся получить данные из кэша
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            from rest_framework.response import Response
            return Response(cached_data)
        
        # Если данных нет в кэше, выполняем запрос
        response = super().list(request, *args, **kwargs)
        
        # Кэшируем результат
        if response.status_code == 200:
            cache.set(cache_key, response.data, self.cache_timeout)
        
        return response
    
    def get_cache_keys_to_invalidate(self):
        """Переопределяем для инвалидации собственного кэша"""
        keys = super().get_cache_keys_to_invalidate() if hasattr(super(), 'get_cache_keys_to_invalidate') else []
        keys.append(self.get_cache_key())
        return keys
