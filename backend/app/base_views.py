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
    
    def _get_participant_for_context(self, eventum):
        """
        Получает participant для контекста сериализатора.
        Сначала пытается получить текущего участника пользователя,
        затем проверяет query-параметр 'participant' (только для организаторов).
        
        Args:
            eventum: Объект Eventum
            
        Returns:
            tuple: (participant, participant_id) или (None, None)
        """
        request = self.request
        participant = None
        participant_id = None
        
        # ЗАГРУЖАЕМ participant заранее, если пользователь аутентифицирован
        if request and request.user.is_authenticated:
            try:
                from .models import Participant
                participant = Participant.objects.select_related('user', 'eventum').prefetch_related(
                    'groups',
                    'groups__tags'
                ).get(user=request.user, eventum=eventum)
            except Participant.DoesNotExist:
                participant = None
        
        # Проверяем query-параметр для просмотра от лица другого участника
        participant_param = request.query_params.get('participant') if request else None
        if participant_param:
            try:
                participant_id = int(participant_param)
            except (TypeError, ValueError):
                participant_id = None
            
            if participant_id:
                # Разрешаем указывать participant только организаторам данного eventum
                from .models import Participant, UserRole
                is_organizer = UserRole.objects.filter(
                    user=request.user, 
                    eventum=eventum, 
                    role='organizer'
                ).exists()
                if is_organizer:
                    try:
                        participant = Participant.objects.select_related('user', 'eventum').prefetch_related(
                            'groups',
                            'groups__tags'
                        ).get(id=participant_id, eventum=eventum)
                    except Participant.DoesNotExist:
                        # Игнорируем неверный participant_id
                        pass
        
        return participant, participant_id
    
    def get_serializer_context(self):
        """Добавляет eventum и participant в контекст сериализатора"""
        context = super().get_serializer_context()
        eventum = self.get_eventum()
        context['eventum'] = eventum
        context['user_role'] = self.get_user_role()
        
        # Получаем participant для контекста
        participant, participant_id = self._get_participant_for_context(eventum)
        context['current_participant'] = participant
        if participant_id:
            context['participant_id'] = participant_id
        
        # Также загружаем всех участников eventum для вычисления групп
        # (если event_group_v2 не имеет inclusive связей, возвращаются все участники)
        if self.action in ['list', 'retrieve']:
            from .models import Participant
            all_participants = Participant.objects.filter(eventum=eventum).values_list('id', flat=True)
            context['all_participant_ids'] = set(all_participants)
        
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
