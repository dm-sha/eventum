"""
Базовые классы для ViewSets с улучшенной авторизацией
"""
from rest_framework import viewsets
from .auth_utils import EventumMixin


class EventumScopedViewSet(EventumMixin, viewsets.ModelViewSet):
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
