from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes, authentication_classes
from rest_framework.response import Response
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from django.shortcuts import get_object_or_404
from django.http import Http404, HttpResponse
from django.utils import timezone
from django.conf import settings
from django.core.cache import cache
from django.db.models import Prefetch, Count
import requests
import json
from icalendar import Calendar, Event as ICalEvent
from datetime import datetime
import uuid
from urllib.parse import urlsplit, urlunsplit
from .models import Eventum, Participant, ParticipantGroup, GroupTag, Event, EventTag, UserProfile, UserRole, Location, EventWave, EventRegistration, ParticipantGroupV2, ParticipantGroupV2ParticipantRelation, ParticipantGroupV2GroupRelation, ParticipantGroupV2EventRelation
from .serializers import (
    EventumSerializer, ParticipantSerializer, ParticipantGroupSerializer,
    GroupTagSerializer, EventSerializer, EventTagSerializer,
    UserProfileSerializer, UserRoleSerializer, VKAuthSerializer, CustomTokenObtainPairSerializer,
    LocationSerializer, EventWaveSerializer, EventRegistrationSerializer,
    ParticipantGroupV2Serializer, ParticipantGroupV2ParticipantRelationSerializer, ParticipantGroupV2GroupRelationSerializer,
    ParticipantGroupV2EventRelationSerializer
)
from .permissions import IsEventumOrganizer, IsEventumParticipant, IsEventumOrganizerOrReadOnly, IsEventumOrganizerOrReadOnlyForList, IsEventumOrganizerOrPublicReadOnly
from .utils import log_execution_time, csrf_exempt_class_api
from .auth_utils import EventumMixin, require_authentication, require_eventum_role, get_eventum_from_request
from .base_views import EventumScopedViewSet, CachedListMixin
import logging
import mimetypes
import boto3
from botocore.client import Config

logger = logging.getLogger(__name__)


def build_public_base_url(request):
    """Возвращает публичный базовый URL с принудительным HTTPS."""
    configured_base_url = getattr(settings, 'BASE_URL', '') or ''
    configured_base_url = configured_base_url.strip()

    if configured_base_url:
        sanitized = configured_base_url.rstrip('/')
        if not sanitized.startswith(('http://', 'https://')):
            sanitized = f'https://{sanitized}'

        parsed = urlsplit(sanitized)
        netloc = parsed.netloc or parsed.path

        if not netloc:
            raise ValueError('BASE_URL configuration must contain a hostname')

        scheme = 'https'
        return urlunsplit((scheme, netloc, '', '', ''))

    forwarded_proto = request.META.get('HTTP_X_FORWARDED_PROTO')
    scheme = forwarded_proto.split(',')[0] if forwarded_proto else request.scheme
    host = request.META.get('HTTP_X_FORWARDED_HOST') or request.get_host()

    base_url = f'{scheme}://{host}'.rstrip('/')

    if scheme == 'http':
        hostname = host.split(':')[0]
        if hostname not in ('localhost', '127.0.0.1'):
            base_url = base_url.replace('http://', 'https://', 1)

    return base_url

class EventumViewSet(EventumMixin, viewsets.ModelViewSet):
    queryset = Eventum.objects.all()
    serializer_class = EventumSerializer
    lookup_field = 'slug'
    permission_classes = [IsEventumOrganizerOrReadOnlyForList]  # Список - чтение, конкретный - только организаторы
    
    def get_object(self):
        """
        Используем стандартную логику с URL параметрами
        """
        return super().get_object()
    
    def retrieve(self, request, *args, **kwargs):
        """
        Переопределяем retrieve для проверки прав участника или организатора
        """
        eventum = self.get_object()
        
        # Проверяем права доступа: только участники и организаторы могут просматривать eventum
        if request.user.is_authenticated:
            from .auth_utils import get_user_role_in_eventum
            user_role = get_user_role_in_eventum(request.user, eventum)
            # Если пользователь не является участником и не является организатором, возвращаем 403
            if user_role not in ['organizer', 'participant']:
                return Response(
                    {'error': 'Access denied. You must be a participant or organizer to view this eventum.'}, 
                    status=status.HTTP_403_FORBIDDEN
                )
        else:
            # Неаутентифицированные пользователи не имеют доступа
            return Response(
                {'error': 'Access denied. You must be a participant or organizer to view this eventum.'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Вызываем стандартный retrieve
        return super().retrieve(request, *args, **kwargs)
    
    @action(detail=True, methods=['post'], permission_classes=[IsEventumOrganizer])
    def toggle_registration(self, request, slug=None):
        """Переключить состояние регистрации"""
        eventum = self.get_object()
        eventum.registration_open = not eventum.registration_open
        eventum.save()
        
        serializer = self.get_serializer(eventum)
        return Response(serializer.data)


class ParticipantViewSet(CachedListMixin, EventumScopedViewSet):
    queryset = Participant.objects.select_related('user', 'eventum').all()
    serializer_class = ParticipantSerializer
    permission_classes = [IsEventumOrganizerOrReadOnly]  # Организаторы CRUD, участники только чтение
    pagination_class = PageNumberPagination
    
    def get_queryset(self):
        """Оптимизированный queryset для списка участников"""
        return super().get_queryset().select_related(
            'user', 
            'eventum'
        ).prefetch_related(
            'groups__tags'  # Оптимизируем загрузку групп и их тегов
        )
    
    @action(detail=False, methods=['get'])
    @require_authentication
    def me(self, request, eventum_slug=None):
        """Получить участника для текущего пользователя в данном eventum"""
        eventum = self.get_eventum()
        try:
            participant = Participant.objects.get(user=request.user, eventum=eventum)
            serializer = self.get_serializer(participant)
            return Response(serializer.data)
        except Participant.DoesNotExist:
            return Response({'error': 'User is not a participant in this eventum'}, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=False, methods=['post'])
    @require_authentication
    def join(self, request, eventum_slug=None):
        """Присоединиться к eventum как участник"""
        eventum = self.get_eventum()
        
        # Проверяем, не является ли пользователь уже участником
        if Participant.objects.filter(user=request.user, eventum=eventum).exists():
            return Response({'error': 'User is already a participant in this eventum'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Создаем участника
        participant_data = {
            'user_id': request.user.id,
            'name': request.user.name,
            'eventum': eventum
        }
        
        serializer = self.get_serializer(data=participant_data)
        if serializer.is_valid():
            participant = serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['delete'])
    @require_authentication
    def leave(self, request, eventum_slug=None):
        """Покинуть eventum"""
        eventum = self.get_eventum()
        try:
            participant = Participant.objects.get(user=request.user, eventum=eventum)
            participant.delete()
            return Response({'status': 'success'}, status=status.HTTP_200_OK)
        except Participant.DoesNotExist:
            return Response({'error': 'User is not a participant in this eventum'}, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=False, methods=['get'])
    @require_authentication
    def my_registrations(self, request, eventum_slug=None):
        """Получить мероприятия, на которые зарегистрирован текущий участник"""
        from django.db.models import Q, Exists, OuterRef, Prefetch
        from .models import Participant, ParticipantGroupV2ParticipantRelation, ParticipantGroupV2GroupRelation
        
        eventum = self.get_eventum()
        
        try:
            participant = Participant.objects.get(user=request.user, eventum=eventum)
        except Participant.DoesNotExist:
            return Response({'error': 'User is not a participant in this eventum'}, status=status.HTTP_404_NOT_FOUND)
        
        # Получаем события, на которые участник зарегистрирован или подал заявку
        # Для типа button: участник в event_group_v2
        # Для типа application: участник в applicants
        button_events = Event.objects.filter(
            eventum=eventum,
            registration__registration_type=EventRegistration.RegistrationType.BUTTON,
            event_group_v2__participant_relations__participant=participant,
            event_group_v2__participant_relations__relation_type=ParticipantGroupV2ParticipantRelation.RelationType.INCLUSIVE
        ).distinct()
        
        application_events = Event.objects.filter(
            eventum=eventum,
            registration__registration_type=EventRegistration.RegistrationType.APPLICATION,
            registration__applicants=participant
        ).distinct()
        
        # Объединяем результаты
        
        events = (button_events | application_events).distinct().select_related(
            'eventum', 'event_group_v2'
        ).prefetch_related(
            'locations', 'tags', 'registration',
            'registration__applicants',  # Для проверки is_registered для APPLICATION типа
            # КРИТИЧНО: загружаем все participant_relations и group_relations
            # чтобы избежать N+1 запросов в has_participant
            Prefetch(
                'event_group_v2__participant_relations',
                queryset=ParticipantGroupV2ParticipantRelation.objects.select_related('participant')
            ),
            Prefetch(
                'event_group_v2__group_relations',
                queryset=ParticipantGroupV2GroupRelation.objects.select_related('target_group')
            ),
            'event_group_v2__group_relations__target_group__participant_relations',
        ).order_by('-start_time')
        
        # Загружаем всех участников eventum для вычисления групп
        all_participants = Participant.objects.filter(eventum=eventum).values_list('id', flat=True)
        
        # Передаём participant в контекст для правильного вычисления is_participant и is_registered
        serializer = EventSerializer(events, many=True, context={
            'request': request,
            'participant_id': participant.id,
            'current_participant': participant,  # Для оптимизации
            'all_participant_ids': set(all_participants)  # Для оптимизации
        })
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'], permission_classes=[IsEventumOrganizer])
    def registrations(self, request, eventum_slug=None, pk=None):
        """Получить мероприятия, на которые зарегистрирован конкретный участник (только для организаторов)"""
        eventum = self.get_eventum()
        
        try:
            participant = self.get_object()
        except Participant.DoesNotExist:
            return Response({'error': 'Participant not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Получаем события, на которые участник зарегистрирован или подал заявку
        from django.db.models import Q, Prefetch
        from .models import ParticipantGroupV2ParticipantRelation, ParticipantGroupV2GroupRelation
        
        button_events = Event.objects.filter(
            eventum=eventum,
            registration__registration_type=EventRegistration.RegistrationType.BUTTON,
            event_group_v2__participant_relations__participant=participant,
            event_group_v2__participant_relations__relation_type=ParticipantGroupV2ParticipantRelation.RelationType.INCLUSIVE
        ).distinct()
        
        application_events = Event.objects.filter(
            eventum=eventum,
            registration__registration_type=EventRegistration.RegistrationType.APPLICATION,
            registration__applicants=participant
        ).distinct()
        
        # Объединяем результаты
        
        events = (button_events | application_events).distinct().select_related(
            'eventum', 'event_group_v2'
        ).prefetch_related(
            'locations', 'tags', 'registration',
            'registration__applicants',  # Для проверки is_registered для APPLICATION типа
            # КРИТИЧНО: загружаем все participant_relations и group_relations
            # чтобы избежать N+1 запросов в has_participant
            Prefetch(
                'event_group_v2__participant_relations',
                queryset=ParticipantGroupV2ParticipantRelation.objects.select_related('participant')
            ),
            Prefetch(
                'event_group_v2__group_relations',
                queryset=ParticipantGroupV2GroupRelation.objects.select_related('target_group')
            ),
            'event_group_v2__group_relations__target_group__participant_relations',
        ).order_by('-start_time')
        
        # Загружаем всех участников eventum для вычисления групп
        from .models import Participant
        all_participants = Participant.objects.filter(eventum=eventum).values_list('id', flat=True)
        
        # Передаём ID участника в контекст, чтобы is_registered проверял регистрацию именно этого участника
        # Также передаем participant объект и all_participant_ids для оптимизации
        serializer = EventSerializer(events, many=True, context={
            'request': request, 
            'participant_id': participant.id,
            'current_participant': participant,  # Для оптимизации
            'all_participant_ids': set(all_participants)  # Для оптимизации
        })
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'], permission_classes=[IsEventumOrganizer])
    def filter_by_events(self, request, eventum_slug=None):
        """Получить участников по фильтру мероприятий"""
        eventum = self.get_eventum()
        
        # Получаем параметры из запроса
        filter_type = request.data.get('filter_type')  # 'participating' или 'not_participating'
        event_ids = request.data.get('event_ids', [])  # список ID мероприятий
        
        print(f"DEBUG: filter_by_events called with filter_type={filter_type}, event_ids={event_ids}")
        
        if not filter_type or filter_type not in ['participating', 'not_participating']:
            return Response({'error': 'Invalid filter_type. Must be "participating" or "not_participating"'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        if not event_ids:
            return Response({'error': 'event_ids is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Проверяем, что все мероприятия принадлежат данному eventum
        events = Event.objects.filter(id__in=event_ids, eventum=eventum)
        print(f"DEBUG: Found {events.count()} events out of {len(event_ids)} requested")
        
        # Выводим информацию о типах мероприятий
        for event in events:
            print(f"DEBUG: Event '{event.name}' (ID: {event.id}) - participant_type: {event.participant_type}")
        
        if events.count() != len(event_ids):
            return Response({'error': 'Some events do not belong to this eventum'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        # Получаем всех участников eventum
        participants = Participant.objects.filter(eventum=eventum)
        print(f"DEBUG: Total participants in eventum: {participants.count()}")
        
        if filter_type == 'participating':
            # Участники, которые участвуют хотя бы в одном из указанных мероприятий
            from django.db.models import Q
            
            # Создаем условия для участия в мероприятиях
            participation_conditions = Q()
            
            for event in events:
                if event.participant_type == 'all':
                    # Для мероприятий типа "для всех" - все участники участвуют
                    participation_conditions |= Q(id__isnull=False)  # Все участники
                elif event.participant_type == 'manual':
                    # Для мероприятий типа "manual" - участники связаны напрямую или через группы/теги
                    event_condition = Q(
                        # Прямая связь через поле participants
                        Q(individual_events=event) |
                        # Связь через группы
                        Q(groups__events=event) |
                        # Связь через теги групп
                        Q(groups__tags__events=event)
                    )
                    participation_conditions |= event_condition
            
            participants = participants.filter(participation_conditions).distinct()
            print(f"DEBUG: Participants participating in events: {participants.count()}")
        else:  # not_participating
            # Участники, которые НЕ участвуют ни в одном из указанных мероприятий
            from django.db.models import Q
            
            # Создаем условия для НЕ участия в мероприятиях
            exclusion_conditions = Q()
            
            for event in events:
                if event.participant_type == 'all':
                    # Для мероприятий типа "для всех" - все участники участвуют, поэтому исключаем всех
                    exclusion_conditions |= Q(id__isnull=False)  # Все участники
                elif event.participant_type == 'manual':
                    # Для мероприятий типа "manual" - участники связаны напрямую или через группы/теги
                    event_condition = Q(
                        # Прямая связь через поле participants
                        Q(individual_events=event) |
                        # Связь через группы
                        Q(groups__events=event) |
                        # Связь через теги групп
                        Q(groups__tags__events=event)
                    )
                    exclusion_conditions |= event_condition
            
            participants = participants.exclude(exclusion_conditions).distinct()
            print(f"DEBUG: Participants NOT participating in events: {participants.count()}")
        
        # Оптимизируем запрос
        participants = participants.select_related('user', 'eventum').prefetch_related(
            'groups__tags'
        )
        
        serializer = self.get_serializer(participants, many=True)
        print(f"DEBUG: Returning {len(serializer.data)} participants")
        return Response(serializer.data)
    
    def perform_create(self, serializer):
        """Переопределяем для инвалидации кэша при создании"""
        super().perform_create(serializer)
        eventum_slug = self.kwargs.get('eventum_slug')
        cache_key = f"participants_list_{eventum_slug}"
        cache.delete(cache_key)
        # Инвалидируем кэш iCalendar файлов для всех участников этого eventum
        self._invalidate_ical_cache(eventum_slug)
    
    def perform_update(self, serializer):
        """Переопределяем для инвалидации кэша при обновлении"""
        super().perform_update(serializer)
        eventum_slug = self.kwargs.get('eventum_slug')
        cache_key = f"participants_list_{eventum_slug}"
        cache.delete(cache_key)
        # Инвалидируем кэш iCalendar файлов для всех участников этого eventum
        self._invalidate_ical_cache(eventum_slug)
    
    def perform_destroy(self, instance):
        """Переопределяем для инвалидации кэша при удалении"""
        eventum_slug = self.kwargs.get('eventum_slug')
        super().perform_destroy(instance)
        cache_key = f"participants_list_{eventum_slug}"
        cache.delete(cache_key)
        # Инвалидируем кэш iCalendar файлов для всех участников этого eventum
        self._invalidate_ical_cache(eventum_slug)
    
    def _invalidate_ical_cache(self, eventum_slug):
        """Инвалидирует кэш iCalendar файлов для всех участников eventum"""
        try:
            # Получаем всех участников этого eventum
            participant_ids = Participant.objects.filter(eventum__slug=eventum_slug).values_list('id', flat=True)
            
            # Удаляем кэш для каждого участника
            for participant_id in participant_ids:
                cache_key = f"ical_calendar_{eventum_slug}_{participant_id}"
                cache.delete(cache_key)
            
            logger.info(f"Инвалидирован кэш iCalendar для {len(participant_ids)} участников eventum {eventum_slug}")
        except Exception as e:
            logger.error(f"Ошибка при инвалидации кэша iCalendar: {str(e)}")

class ParticipantGroupViewSet(CachedListMixin, EventumScopedViewSet):
    queryset = ParticipantGroup.objects.all().prefetch_related(
        'participants',
        'participants__user',  # Добавляем prefetch для пользователей участников
        'tags',
        'participants__eventum'  # Добавляем prefetch для eventum участников
    )
    serializer_class = ParticipantGroupSerializer
    permission_classes = [IsEventumOrganizerOrReadOnly]  # Организаторы CRUD, участники только чтение
    
    def get_queryset(self):
        """Оптимизированный queryset для списка групп"""
        eventum = self.get_eventum()
        return ParticipantGroup.objects.filter(eventum=eventum).prefetch_related(
            'participants',
            'participants__user',  # Добавляем prefetch для пользователей участников
            'tags',
            'participants__eventum'
        ).select_related('eventum')  # Добавляем select_related для eventum
    
    @log_execution_time("Получение списка групп участников")
    def list(self, request, *args, **kwargs):
        """Переопределяем list для добавления кэширования"""
        # Для пагинированных запросов не используем кэширование
        if request.GET.get('page'):
            return super().list(request, *args, **kwargs)
        
        eventum_slug = kwargs.get('eventum_slug')
        cache_key = f"groups_list_{eventum_slug}"
        
        # Пытаемся получить данные из кэша
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            logger.info(f"Данные групп получены из кэша для {eventum_slug}")
            return Response(cached_data)
        
        # Если данных нет в кэше, выполняем запрос
        logger.info(f"Загрузка групп из БД для {eventum_slug}")
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        
        # Кэшируем результат на 5 минут
        cache.set(cache_key, serializer.data, 300)
        logger.info(f"Кэшировано {len(serializer.data)} групп для {eventum_slug}")
        
        return Response(serializer.data)
    
    def perform_create(self, serializer):
        """Переопределяем для инвалидации кэша при создании"""
        super().perform_create(serializer)
        eventum_slug = self.kwargs.get('eventum_slug')
        cache_key = f"groups_list_{eventum_slug}"
        cache.delete(cache_key)
        # Инвалидируем кэш iCalendar файлов для всех участников этого eventum
        self._invalidate_ical_cache(eventum_slug)
    
    def perform_update(self, serializer):
        """Переопределяем для инвалидации кэша при обновлении"""
        super().perform_update(serializer)
        eventum_slug = self.kwargs.get('eventum_slug')
        cache_key = f"groups_list_{eventum_slug}"
        cache.delete(cache_key)
        # Инвалидируем кэш iCalendar файлов для всех участников этого eventum
        self._invalidate_ical_cache(eventum_slug)
    
    def perform_destroy(self, instance):
        """Переопределяем для инвалидации кэша при удалении"""
        super().perform_destroy(instance)
        eventum_slug = self.kwargs.get('eventum_slug')
        cache_key = f"groups_list_{eventum_slug}"
        cache.delete(cache_key)
        # Инвалидируем кэш iCalendar файлов для всех участников этого eventum
        self._invalidate_ical_cache(eventum_slug)
    
    def _invalidate_ical_cache(self, eventum_slug):
        """Инвалидирует кэш iCalendar файлов для всех участников eventum"""
        try:
            # Получаем всех участников этого eventum
            participant_ids = Participant.objects.filter(eventum__slug=eventum_slug).values_list('id', flat=True)
            
            # Удаляем кэш для каждого участника
            for participant_id in participant_ids:
                cache_key = f"ical_calendar_{eventum_slug}_{participant_id}"
                cache.delete(cache_key)
            
            logger.info(f"Инвалидирован кэш iCalendar для {len(participant_ids)} участников eventum {eventum_slug}")
        except Exception as e:
            logger.error(f"Ошибка при инвалидации кэша iCalendar: {str(e)}")

class GroupTagViewSet(EventumScopedViewSet, viewsets.ModelViewSet):
    queryset = GroupTag.objects.all().prefetch_related(
        'groups__participants',
        'groups__tags',
    )
    serializer_class = GroupTagSerializer
    permission_classes = [IsEventumOrganizerOrReadOnly]  # Организаторы CRUD, участники только чтение
    pagination_class = PageNumberPagination
    
    def get_queryset(self):
        """Оптимизированный queryset для списка тегов групп"""
        eventum = self.get_eventum()
        return GroupTag.objects.filter(eventum=eventum).prefetch_related(
            'groups__participants__user',
            'groups__tags'
        ).select_related('eventum')
    
    @log_execution_time("Получение списка тегов групп")
    def list(self, request, *args, **kwargs):
        """Переопределяем list для добавления кэширования"""
        # Для пагинированных запросов не используем кэширование
        if request.GET.get('page'):
            return super().list(request, *args, **kwargs)
        
        eventum_slug = kwargs.get('eventum_slug')
        cache_key = f"group_tags_list_{eventum_slug}"
        
        # Пытаемся получить данные из кэша
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            logger.info(f"Данные тегов групп получены из кэша для {eventum_slug}")
            return Response(cached_data)
        
        # Если данных нет в кэше, выполняем запрос
        logger.info(f"Загрузка тегов групп из БД для {eventum_slug}")
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        
        # Кэшируем результат на 5 минут
        cache.set(cache_key, serializer.data, 300)
        logger.info(f"Кэшировано {len(serializer.data)} тегов групп для {eventum_slug}")
        
        return Response(serializer.data)
    
    def perform_create(self, serializer):
        """Переопределяем для инвалидации кэша при создании"""
        eventum = self.get_eventum()
        serializer.save(eventum=eventum)
        # Инвалидируем кэш
        cache_key = f"group_tags_list_{eventum.slug}"
        cache.delete(cache_key)
        # Также инвалидируем кэш групп, так как теги влияют на группы
        cache.delete(f"groups_list_{eventum.slug}")
    
    def perform_update(self, serializer):
        """Переопределяем для инвалидации кэша при обновлении"""
        eventum = self.get_eventum()
        serializer.save()
        # Инвалидируем кэш
        cache_key = f"group_tags_list_{eventum.slug}"
        cache.delete(cache_key)
        # Также инвалидируем кэш групп
        cache.delete(f"groups_list_{eventum.slug}")
    
    def perform_destroy(self, instance):
        """Переопределяем для инвалидации кэша при удалении"""
        eventum = self.get_eventum()
        instance.delete()
        # Инвалидируем кэш
        cache_key = f"group_tags_list_{eventum.slug}"
        cache.delete(cache_key)
        # Также инвалидируем кэш групп
        cache.delete(f"groups_list_{eventum.slug}")

    @action(detail=True, methods=['get'])
    def groups(self, request, eventum_slug=None, pk=None):
        """Получить все группы с данным тегом"""
        group_tag = self.get_object()
        groups = group_tag.groups.all().prefetch_related('participants', 'tags')
        serializer = ParticipantGroupSerializer(groups, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='groups/(?P<group_id>[^/.]+)')
    def add_group(self, request, eventum_slug=None, pk=None, group_id=None):
        """Привязать группу к тегу"""
        group_tag = self.get_object()
        try:
            group = ParticipantGroup.objects.get(id=group_id, eventum__slug=eventum_slug)
            group_tag.groups.add(group)
            # Инвалидируем кэш
            cache.delete(f"group_tags_list_{eventum_slug}")
            cache.delete(f"groups_list_{eventum_slug}")
            return Response({'status': 'success'}, status=status.HTTP_200_OK)
        except ParticipantGroup.DoesNotExist:
            return Response({'error': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['delete'], url_path='groups/(?P<group_id>[^/.]+)')
    def remove_group(self, request, eventum_slug=None, pk=None, group_id=None):
        """Отвязать группу от тега"""
        group_tag = self.get_object()
        try:
            group = ParticipantGroup.objects.get(id=group_id, eventum__slug=eventum_slug)
            group_tag.groups.remove(group)
            # Инвалидируем кэш
            cache.delete(f"group_tags_list_{eventum_slug}")
            cache.delete(f"groups_list_{eventum_slug}")
            return Response({'status': 'success'}, status=status.HTTP_200_OK)
        except ParticipantGroup.DoesNotExist:
            return Response({'error': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)


class ParticipantGroupV2ViewSet(EventumScopedViewSet):
    """ViewSet для новых групп участников V2"""
    queryset = ParticipantGroupV2.objects.all().prefetch_related(
        'participant_relations__participant',
        'group_relations__target_group',
    )
    serializer_class = ParticipantGroupV2Serializer
    permission_classes = [IsEventumOrganizerOrReadOnly]
    
    def get_queryset(self):
        """Оптимизированный queryset для списка групп V2 с использованием Prefetch для предотвращения N+1 запросов"""
        eventum = self.get_eventum()
        # По умолчанию показываем только группы, не связанные с событиями
        show_event_groups = self.request.query_params.get('include_event_groups', 'false').lower() == 'true'
        
        queryset = ParticipantGroupV2.objects.filter(eventum=eventum).order_by('id')
        
        if not show_event_groups:
            queryset = queryset.filter(is_event_group=False)
        
        # Используем Prefetch с явным queryset для точной оптимизации загрузки связей с участниками
        # Это предотвращает N+1 запросы при обращении к participant.groups и group.tags в сериализаторе
        # Добавляем order_by для гарантии детерминированного порядка
        participant_relations_prefetch = Prefetch(
            'participant_relations',
            queryset=ParticipantGroupV2ParticipantRelation.objects.select_related(
                'participant__user',
                'participant__eventum'
            ).prefetch_related(
                'participant__groups',
                'participant__groups__tags'
            ).order_by('id')
        )
        
        # Используем Prefetch для связей групп, хотя они менее критичны
        # Добавляем order_by для гарантии детерминированного порядка
        group_relations_prefetch = Prefetch(
            'group_relations',
            queryset=ParticipantGroupV2GroupRelation.objects.select_related(
                'target_group'
            ).order_by('id')
        )
        
        return queryset.prefetch_related(
            participant_relations_prefetch,
            group_relations_prefetch,
        ).select_related('eventum')
    
    def get_serializer_context(self):
        """Добавляем eventum в контекст сериализатора"""
        context = super().get_serializer_context()
        context['eventum'] = self.get_eventum()
        return context
    
    @log_execution_time("Получение списка групп участников V2")
    def list(self, request, *args, **kwargs):
        """Переопределяем list для логирования"""
        return super().list(request, *args, **kwargs)


class ParticipantGroupV2ParticipantRelationViewSet(EventumScopedViewSet, viewsets.ModelViewSet):
    """ViewSet для связей групп V2 с участниками"""
    queryset = ParticipantGroupV2ParticipantRelation.objects.all()
    serializer_class = ParticipantGroupV2ParticipantRelationSerializer
    permission_classes = [IsEventumOrganizerOrReadOnly]
    
    def get_queryset(self):
        """Оптимизированный queryset для списка связей"""
        eventum = self.get_eventum()
        group_id = self.request.query_params.get('group_id')
        
        queryset = ParticipantGroupV2ParticipantRelation.objects.filter(
            group__eventum=eventum
        ).select_related(
            'group',
            'participant',
            'participant__user',
            'participant__eventum'
        )
        
        if group_id:
            queryset = queryset.filter(group_id=group_id)
        
        return queryset
    
    def get_serializer_context(self):
        """Добавляем eventum в контекст сериализатора"""
        context = super().get_serializer_context()
        context['eventum'] = self.get_eventum()
        return context
    
    def perform_create(self, serializer):
        """Переопределяем для валидации группы"""
        eventum = self.get_eventum()
        # group_id должен быть передан в данных запроса
        validated_data = serializer.validated_data
        group = validated_data.get('group')
        
        if group and group.eventum != eventum:
            raise ValidationError("Group must belong to the same eventum")
        
        serializer.save()


class ParticipantGroupV2GroupRelationViewSet(EventumScopedViewSet, viewsets.ModelViewSet):
    """ViewSet для связей групп V2 с другими группами"""
    queryset = ParticipantGroupV2GroupRelation.objects.all()
    serializer_class = ParticipantGroupV2GroupRelationSerializer
    permission_classes = [IsEventumOrganizerOrReadOnly]
    
    def get_queryset(self):
        """Оптимизированный queryset для списка связей"""
        eventum = self.get_eventum()
        group_id = self.request.query_params.get('group_id')
        
        queryset = ParticipantGroupV2GroupRelation.objects.filter(
            group__eventum=eventum
        ).select_related(
            'group',
            'target_group'
        )
        
        if group_id:
            queryset = queryset.filter(group_id=group_id)
        
        return queryset
    
    def get_serializer_context(self):
        """Добавляем eventum в контекст сериализатора"""
        context = super().get_serializer_context()
        context['eventum'] = self.get_eventum()
        return context
    
    def perform_create(self, serializer):
        """Переопределяем для валидации группы"""
        eventum = self.get_eventum()
        # group_id должен быть передан в данных запроса
        validated_data = serializer.validated_data
        group = validated_data.get('group')
        
        if group and group.eventum != eventum:
            raise ValidationError("Group must belong to the same eventum")
        
        serializer.save()


class ParticipantGroupV2EventRelationViewSet(EventumScopedViewSet, viewsets.ModelViewSet):
    """ViewSet для связей групп V2 с событиями"""
    queryset = ParticipantGroupV2EventRelation.objects.all()
    serializer_class = ParticipantGroupV2EventRelationSerializer
    permission_classes = [IsEventumOrganizerOrReadOnly]
    
    def get_queryset(self):
        """Оптимизированный queryset для списка связей"""
        eventum = self.get_eventum()
        group_id = self.request.query_params.get('group_id')
        event_id = self.request.query_params.get('event_id')
        
        # Фильтруем по eventum группы И события, чтобы убедиться, что оба принадлежат одному eventum
        queryset = ParticipantGroupV2EventRelation.objects.filter(
            group__eventum=eventum,
            event__eventum=eventum
        ).select_related(
            'group',
            'event',
            'event__eventum'
        )
        
        if group_id:
            queryset = queryset.filter(group_id=group_id)
        
        if event_id:
            queryset = queryset.filter(event_id=event_id)
        
        return queryset
    
    def get_serializer_context(self):
        """Добавляем eventum в контекст сериализатора"""
        context = super().get_serializer_context()
        context['eventum'] = self.get_eventum()
        return context
    
    def perform_create(self, serializer):
        """Переопределяем для валидации группы и события"""
        eventum = self.get_eventum()
        validated_data = serializer.validated_data
        group = validated_data.get('group')
        event = validated_data.get('event')
        
        if group and group.eventum != eventum:
            raise ValidationError("Group must belong to the same eventum")
        
        if event and event.eventum != eventum:
            raise ValidationError("Event must belong to the same eventum")
        
        serializer.save()


class EventTagViewSet(EventumScopedViewSet, viewsets.ModelViewSet):
    queryset = EventTag.objects.all()
    serializer_class = EventTagSerializer
    permission_classes = [IsEventumOrganizerOrPublicReadOnly]  # Организаторы CRUD, все остальные только чтение

class EventWaveViewSet(EventumScopedViewSet, viewsets.ModelViewSet):
    queryset = EventWave.objects.all()
    serializer_class = EventWaveSerializer
    permission_classes = [IsEventumOrganizerOrReadOnly]

    def get_queryset(self):
        from django.db.models import Prefetch
        from .models import ParticipantGroupV2ParticipantRelation, ParticipantGroupV2GroupRelation
        
        eventum = self.get_eventum()
        return EventWave.objects.filter(eventum=eventum).select_related(
            'eventum'
        ).prefetch_related(
            'registrations',
            'registrations__event',
            'registrations__event__eventum',
            'registrations__event__locations',
            'registrations__event__tags',
            'registrations__event__event_group_v2',  # Для EventSerializer
            'registrations__event__event_group_v2__participant_relations',
            'registrations__event__event_group_v2__group_relations',
            'registrations__applicants',  # Для get_registered_count и is_full
            'registrations__applicants__user',
            'registrations__allowed_group',
            # КРИТИЧНО: загружаем все participant_relations и group_relations
            # чтобы избежать N+1 запросов в has_participant
            Prefetch(
                'registrations__allowed_group__participant_relations',
                queryset=ParticipantGroupV2ParticipantRelation.objects.select_related('participant')
            ),
            Prefetch(
                'registrations__allowed_group__group_relations',
                queryset=ParticipantGroupV2GroupRelation.objects.select_related('target_group')
            ),
            'registrations__allowed_group__group_relations__target_group__participant_relations',
            'registrations__allowed_group__group_relations__target_group__group_relations',
        ).order_by('id')

    def get_serializer_context(self):
        """Добавляем eventum и (опционально) участника из query-параметра в контекст сериализатора."""
        context = super().get_serializer_context()
        eventum = self.get_eventum()
        context['eventum'] = eventum

        # ЗАГРУЖАЕМ participant заранее, если пользователь аутентифицирован
        request = self.request
        if request and request.user.is_authenticated:
            try:
                from .models import Participant
                participant = Participant.objects.select_related('user', 'eventum').prefetch_related(
                    'groups',
                    'groups__tags'
                ).get(user=request.user, eventum=eventum)
                context['_current_participant'] = participant
                context['current_participant'] = participant  # Для совместимости
            except Participant.DoesNotExist:
                context['_current_participant'] = None
                context['current_participant'] = None

        # Проверяем query-параметр для просмотра от лица другого участника
        participant_param = self.request.query_params.get('participant')
        if participant_param:
            try:
                participant_id = int(participant_param)
            except (TypeError, ValueError):
                participant_id = None

            if participant_id:
                # Разрешаем указывать participant только организаторам данного eventum
                from .models import Participant, UserRole
                is_organizer = UserRole.objects.filter(user=self.request.user, eventum=eventum, role='organizer').exists()
                if is_organizer:
                    try:
                        participant = Participant.objects.select_related('user', 'eventum').prefetch_related(
                            'groups',
                            'groups__tags'
                        ).get(id=participant_id, eventum=eventum)
                        context['_current_participant'] = participant
                        context['current_participant'] = participant
                    except Participant.DoesNotExist:
                        # Игнорируем неверный participant_id
                        pass

        # Также загружаем всех участников eventum для вычисления групп
        # (если event_group_v2 не имеет inclusive связей, возвращаются все участники)
        if self.action in ['list', 'retrieve']:
            from .models import Participant
            all_participants = Participant.objects.filter(eventum=eventum).values_list('id', flat=True)
            context['all_participant_ids'] = set(all_participants)

        return context


class EventRegistrationViewSet(EventumScopedViewSet, viewsets.ModelViewSet):
    """ViewSet для управления регистрациями на мероприятия"""
    queryset = EventRegistration.objects.all()
    serializer_class = EventRegistrationSerializer
    permission_classes = [IsEventumOrganizerOrReadOnly]

    def get_queryset(self):
        eventum = self.get_eventum()
        return EventRegistration.objects.filter(
            event__eventum=eventum
        ).select_related(
            'event',
            'event__eventum',
            'event__event_group_v2',  # Для подсчета участников мероприятия
            'allowed_group'
        ).prefetch_related(
            'event__locations',
            'event__tags',
            'applicants'
        ).order_by('-id')
    
    def perform_create(self, serializer):
        """Переопределяем, чтобы не передавать eventum (его нет в модели EventRegistration)"""
        serializer.save()


@csrf_exempt_class_api
class EventViewSet(CachedListMixin, EventumScopedViewSet, viewsets.ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer
    permission_classes = [IsEventumOrganizerOrPublicReadOnly]  # Организаторы CRUD, все остальные только чтение
    
    def get_queryset(self):
        """Оптимизированный queryset для списка событий с prefetch_related"""
        from django.db.models import Count, Exists, OuterRef, Prefetch
        from .models import ParticipantGroupV2ParticipantRelation, ParticipantGroupV2GroupRelation
        
        eventum = self.get_eventum()
        
        # Базовый queryset с аннотациями
        queryset = Event.objects.filter(eventum=eventum).select_related(
            'eventum',
            'event_group_v2'  # Добавляем select_related для event_group_v2
        ).annotate(
            participants_count=Count('participants', distinct=True)
        )
        
        # Добавляем prefetch только для необходимых данных
        queryset = queryset.prefetch_related(
            'tags',  # Всегда нужны для сериализации
            'group_tags',  # Всегда нужны для сериализации
            'locations',  # Всегда нужны для сериализации
            'groups',  # Всегда нужны для сериализации
            'groups__tags',  # Нужны для сериализации групп
        )
        
        # Условный prefetch для участников и регистраций только если нужно
        if self.action in ['list', 'retrieve']:
            # Prefetch для event_group_v2 со всеми связями для оптимизации has_participant
            queryset = queryset.prefetch_related(
                'participants',
                'participants__user',
                'registration',
                'registration__applicants',
                'registration__applicants__user',
                # КРИТИЧНО: загружаем все participant_relations и group_relations
                # чтобы избежать N+1 запросов в has_participant
                Prefetch(
                    'event_group_v2__participant_relations',
                    queryset=ParticipantGroupV2ParticipantRelation.objects.select_related('participant')
                ),
                Prefetch(
                    'event_group_v2__group_relations',
                    queryset=ParticipantGroupV2GroupRelation.objects.select_related('target_group')
                ),
                # Для рекурсивных групп (если нужно)
                'event_group_v2__group_relations__target_group__participant_relations',
            )
        
        return queryset
    
    def get_serializer_context(self):
        """Добавляем participant в контекст, чтобы не делать запросы в сериализаторе"""
        context = super().get_serializer_context()
        eventum = self.get_eventum()
        context['eventum'] = eventum
        
        # ЗАГРУЖАЕМ participant заранее, если пользователь аутентифицирован
        request = self.request
        if request and request.user.is_authenticated:
            try:
                from .models import Participant
                participant = Participant.objects.select_related('user', 'eventum').prefetch_related(
                    'groups',
                    'groups__tags'
                ).get(user=request.user, eventum=eventum)
                context['current_participant'] = participant
            except Participant.DoesNotExist:
                context['current_participant'] = None
        else:
            context['current_participant'] = None
        
        # Также загружаем всех участников eventum для вычисления групп
        # (если event_group_v2 не имеет inclusive связей, возвращаются все участники)
        if self.action in ['list', 'retrieve']:
            from .models import Participant
            all_participants = Participant.objects.filter(eventum=eventum).values_list('id', flat=True)
            context['all_participant_ids'] = set(all_participants)
        
        return context

    @log_execution_time("Получение списка событий")
    def list(self, request, *args, **kwargs):
        """Переопределяем list для добавления кэширования"""
        # Для пагинированных запросов не используем кэширование
        if request.GET.get('page'):
            return super().list(request, *args, **kwargs)
        
        eventum_slug = kwargs.get('eventum_slug')
        cache_key = f"events_list_{eventum_slug}"
        
        # Пытаемся получить данные из кэша
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            logger.info(f"Данные событий получены из кэша для {eventum_slug}")
            return Response(cached_data)
        
        # Если данных нет в кэше, выполняем запрос
        logger.info(f"Загрузка событий из БД для {eventum_slug}")
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        
        # Кэшируем результат на 2 минуты (события могут часто изменяться)
        cache.set(cache_key, serializer.data, 120)
        logger.info(f"Кэшировано {len(serializer.data)} событий для {eventum_slug}")
        
        return Response(serializer.data)

    def perform_create(self, serializer):
        """Переопределяем для инвалидации кэша при создании"""
        super().perform_create(serializer)
        eventum_slug = self.kwargs.get('eventum_slug')
        cache_key = f"events_list_{eventum_slug}"
        cache.delete(cache_key)
        # Инвалидируем кэш iCalendar файлов для всех участников этого eventum
        self._invalidate_ical_cache(eventum_slug)
    
    def perform_update(self, serializer):
        """Переопределяем для инвалидации кэша при обновлении"""
        super().perform_update(serializer)
        eventum_slug = self.kwargs.get('eventum_slug')
        cache_key = f"events_list_{eventum_slug}"
        cache.delete(cache_key)
        # Инвалидируем кэш iCalendar файлов для всех участников этого eventum
        self._invalidate_ical_cache(eventum_slug)
    
    def perform_destroy(self, instance):
        """Переопределяем для инвалидации кэша при удалении"""
        eventum_slug = self.kwargs.get('eventum_slug')
        super().perform_destroy(instance)
        cache_key = f"events_list_{eventum_slug}"
        cache.delete(cache_key)
        # Инвалидируем кэш iCalendar файлов для всех участников этого eventum
        self._invalidate_ical_cache(eventum_slug)
    
    def _invalidate_ical_cache(self, eventum_slug):
        """Инвалидирует кэш iCalendar файлов для всех участников eventum"""
        try:
            # Получаем всех участников этого eventum
            participant_ids = Participant.objects.filter(eventum__slug=eventum_slug).values_list('id', flat=True)
            
            # Удаляем кэш для каждого участника
            for participant_id in participant_ids:
                cache_key = f"ical_calendar_{eventum_slug}_{participant_id}"
                cache.delete(cache_key)
            
            logger.info(f"Инвалидирован кэш iCalendar для {len(participant_ids)} участников eventum {eventum_slug}")
        except Exception as e:
            logger.error(f"Ошибка при инвалидации кэша iCalendar: {str(e)}")

    def _get_participant(self, request, eventum):
        """Получить участника для текущего пользователя"""
        if not request.user.is_authenticated:
            return None, Response({'error': 'Not authenticated'}, status=status.HTTP_401_UNAUTHORIZED)
        
        try:
            participant = Participant.objects.get(user=request.user, eventum=eventum)
            return participant, None
        except Participant.DoesNotExist:
            return None, Response({'error': 'User is not a participant in this eventum'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'], permission_classes=[IsEventumParticipant])
    def register(self, request, eventum_slug=None, pk=None):
        """Зарегистрироваться на мероприятие или подать заявку"""
        from django.db import transaction
        
        eventum = self.get_eventum()
        event = self.get_object()
        
        # Получаем участника
        participant, error_response = self._get_participant(request, eventum)
        if error_response:
            return error_response
        
        # Проверяем, открыта ли регистрация
        if not eventum.registration_open:
            return Response({'error': 'Registration is currently closed'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Проверяем, есть ли настройка регистрации для мероприятия
        try:
            registration = event.registration
        except EventRegistration.DoesNotExist:
            return Response({'error': 'Event registration is not configured'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Проверяем allowed_group (если указана)
        if registration.allowed_group:
            allowed_participants = registration.allowed_group.get_participants()
            if not allowed_participants.filter(id=participant.id).exists():
                return Response({'error': 'You are not allowed to register for this event'}, status=status.HTTP_403_FORBIDDEN)
        
        # Атомарная операция регистрации
        try:
            with transaction.atomic():
                if registration.registration_type == EventRegistration.RegistrationType.BUTTON:
                    # Для типа button: добавляем участника в event_group_v2
                    if not event.event_group_v2:
                        return Response({'error': 'Event group is not configured'}, status=status.HTTP_400_BAD_REQUEST)
                    
                    # Проверяем, не переполнена ли регистрация
                    if registration.is_full():
                        return Response({'error': 'Event registration is full'}, status=status.HTTP_400_BAD_REQUEST)
                    
                    # Проверяем, не зарегистрирован ли уже
                    if event.event_group_v2.has_participant(participant.id):
                        return Response({'error': 'Already registered for this event'}, status=status.HTTP_400_BAD_REQUEST)
                    
                    # Добавляем участника в группу через ParticipantGroupV2ParticipantRelation
                    ParticipantGroupV2ParticipantRelation.objects.get_or_create(
                        group=event.event_group_v2,
                        participant=participant,
                        defaults={'relation_type': ParticipantGroupV2ParticipantRelation.RelationType.INCLUSIVE}
                    )
                    
                    # Инвалидируем кеш списка событий
                    cache_key = f"events_list_{eventum_slug}"
                    cache.delete(cache_key)
                    self._invalidate_ical_cache(eventum_slug)
                    
                    return Response({'status': 'success', 'message': 'Successfully registered for event'}, status=status.HTTP_201_CREATED)
                
                else:  # APPLICATION
                    # Для типа application: добавляем участника в applicants
                    # Для типа APPLICATION заявок может быть больше чем max_participants,
                    # администратор потом выберет, кого одобрить
                    
                    # Проверяем, не подал ли уже заявку
                    if registration.applicants.filter(id=participant.id).exists():
                        return Response({'error': 'Application already submitted'}, status=status.HTTP_400_BAD_REQUEST)
                    
                    # Добавляем участника в applicants
                    registration.applicants.add(participant)
                    
                    # Инвалидируем кеш списка событий
                    cache_key = f"events_list_{eventum_slug}"
                    cache.delete(cache_key)
                    self._invalidate_ical_cache(eventum_slug)
                    
                    return Response({'status': 'success', 'message': 'Application submitted successfully'}, status=status.HTTP_201_CREATED)
                
        except Exception as e:
            # Логируем ошибку для отладки
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error during event registration: {str(e)}")
            return Response({'error': 'Failed to register for event'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['delete'], permission_classes=[IsEventumParticipant])
    def unregister(self, request, eventum_slug=None, pk=None):
        """Отписаться от мероприятия или отозвать заявку"""
        from django.db import transaction
        
        eventum = self.get_eventum()
        event = self.get_object()
        
        # Получаем участника
        participant, error_response = self._get_participant(request, eventum)
        if error_response:
            return error_response
        
        # Проверяем, есть ли настройка регистрации для мероприятия
        try:
            registration = event.registration
        except EventRegistration.DoesNotExist:
            return Response({'error': 'Event registration is not configured'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Атомарная операция отписки
        try:
            with transaction.atomic():
                if registration.registration_type == EventRegistration.RegistrationType.BUTTON:
                    # Для типа button: удаляем участника из event_group_v2
                    if not event.event_group_v2:
                        return Response({'error': 'Not registered for this event'}, status=status.HTTP_404_NOT_FOUND)
                    
                    # Проверяем, зарегистрирован ли
                    if not event.event_group_v2.has_participant(participant.id):
                        return Response({'error': 'Not registered for this event'}, status=status.HTTP_404_NOT_FOUND)
                    
                    # Удаляем связь участника с группой
                    deleted_count, _ = ParticipantGroupV2ParticipantRelation.objects.filter(
                        group=event.event_group_v2,
                        participant=participant
                    ).delete()
                    
                    if deleted_count == 0:
                        return Response({'error': 'Not registered for this event'}, status=status.HTTP_404_NOT_FOUND)
                    
                    # Инвалидируем кеш списка событий
                    cache_key = f"events_list_{eventum_slug}"
                    cache.delete(cache_key)
                    self._invalidate_ical_cache(eventum_slug)
                    
                    return Response({'status': 'success', 'message': 'Successfully unregistered from event'}, status=status.HTTP_200_OK)
                
                else:  # APPLICATION
                    # Для типа application: удаляем участника из applicants
                    if not registration.applicants.filter(id=participant.id).exists():
                        return Response({'error': 'Application not found'}, status=status.HTTP_404_NOT_FOUND)
                    
                    # Удаляем участника из applicants
                    registration.applicants.remove(participant)
                    
                    # Инвалидируем кеш списка событий
                    cache_key = f"events_list_{eventum_slug}"
                    cache.delete(cache_key)
                    self._invalidate_ical_cache(eventum_slug)
                    
                    return Response({'status': 'success', 'message': 'Application withdrawn successfully'}, status=status.HTTP_200_OK)
                
        except Exception as e:
            # Логируем ошибку для отладки
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error during event unregistration: {str(e)}")
            return Response({'error': 'Failed to unregister from event'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)





class LocationViewSet(EventumScopedViewSet, viewsets.ModelViewSet):
    queryset = Location.objects.all().select_related('eventum', 'parent').prefetch_related('children')
    serializer_class = LocationSerializer
    permission_classes = [IsEventumOrganizerOrPublicReadOnly]  # Организаторы CRUD, все остальные только чтение

    def get_queryset(self):
        """Оптимизированный queryset для списка локаций"""
        eventum = self.get_eventum()
        return Location.objects.filter(eventum=eventum).select_related(
            'eventum', 'parent'
        ).prefetch_related('children')

    def list(self, request, *args, **kwargs):
        eventum = self.get_eventum()
        queryset = self.filter_queryset(self.get_queryset())
        children_map = self._build_children_map(eventum)

        page = self.paginate_queryset(queryset)
        context = {**self.get_serializer_context(), 'children_map': children_map}
        if page is not None:
            serializer = self.get_serializer(page, many=True, context=context)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True, context=context)
        return Response(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        eventum = self.get_eventum()
        instance = self.get_object()
        children_map = self._build_children_map(eventum)
        context = {**self.get_serializer_context(), 'children_map': children_map}
        serializer = self.get_serializer(instance, context=context)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def tree(self, request, eventum_slug=None):
        """Получить дерево локаций (только корневые элементы с детьми)"""
        eventum = self.get_eventum()
        children_map = self._build_children_map(eventum)
        root_locations = children_map.get(None, [])
        context = {**self.get_serializer_context(), 'children_map': children_map}
        serializer = self.get_serializer(root_locations, many=True, context=context)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def children(self, request, eventum_slug=None, pk=None):
        """Получить дочерние локации"""
        eventum = self.get_eventum()
        location = self.get_object()
        children_map = self._build_children_map(eventum)
        children = children_map.get(location.id, [])
        context = {**self.get_serializer_context(), 'children_map': children_map}
        serializer = self.get_serializer(children, many=True, context=context)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def by_kind(self, request, eventum_slug=None):
        """Получить локации по типу"""
        eventum = self.get_eventum()
        kind = request.query_params.get('kind')
        
        if not kind:
            return Response({'error': 'kind parameter is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        locations = Location.objects.filter(eventum=eventum, kind=kind)
        serializer = self.get_serializer(locations, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def valid_parents(self, request, eventum_slug=None):
        """Получить список валидных родительских локаций для указанного типа"""
        eventum = self.get_eventum()
        kind = request.query_params.get('kind')
        exclude_id = request.query_params.get('exclude_id')
        
        if not kind:
            return Response({'error': 'kind parameter is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Определяем допустимые типы родительских локаций
        valid_parent_kinds = {
            'venue': [],  # venue не может иметь родителя
            'building': ['venue'],
            'room': ['building'],
            'area': ['venue', 'building'],
            'other': ['venue', 'building', 'room', 'area']  # other может быть дочерним для всех типов
        }
        
        allowed_kinds = valid_parent_kinds.get(kind, [])
        
        # Получаем локации подходящих типов
        queryset = Location.objects.filter(eventum=eventum, kind__in=allowed_kinds)
        
        # Исключаем текущую локацию (если редактируем)
        if exclude_id:
            queryset = queryset.exclude(id=exclude_id)
        
        # Исключаем локации, которые уже являются детьми текущей локации (если редактируем)
        if exclude_id:
            try:
                current_location = Location.objects.get(id=exclude_id)
                # Получаем всех потомков текущей локации
                descendants = self._get_descendants(current_location)
                if descendants:
                    queryset = queryset.exclude(id__in=descendants)
            except Location.DoesNotExist:
                pass
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    def _get_descendants(self, location):
        """Рекурсивно получает всех потомков локации"""
        descendants = []
        children = location.children.all()

        for child in children:
            descendants.append(child.id)
            descendants.extend(self._get_descendants(child))

        return descendants

    def _build_children_map(self, eventum):
        """Строит карту дочерних элементов для всех локаций eventum."""
        locations = list(
            Location.objects.filter(eventum=eventum)
            .select_related('parent')
            .order_by('id')
        )

        children_map = {}
        for location in locations:
            children_map.setdefault(location.parent_id, []).append(location)

        for location_list in children_map.values():
            location_list.sort(key=lambda item: item.name.lower())

        return children_map


# Аутентификация через VK
class VKAuthView(TokenObtainPairView):
    """Авторизация через VK ID"""
    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [AllowAny]  # Разрешаем доступ без аутентификации
    authentication_classes = []  # Отключаем аутентификацию для этого view
    
    def post(self, request, *args, **kwargs):
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"VK Auth request received: {request.data}")
        
        serializer = VKAuthSerializer(data=request.data)
        if not serializer.is_valid():
            logger.error(f"VK Auth validation failed: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        code = serializer.validated_data['code']
        logger.info(f"VK Auth code received: {code[:20]}...")
        
        try:
            # Проверяем, что пришло от фронтенда
            if code.startswith('vk2.a.'):
                # Это access_token от VK ID SDK (уже обмененный на фронтенде)
                access_token = code
                
                # Получаем информацию о пользователе через VK ID API
                import ssl
                import urllib3
                from requests.adapters import HTTPAdapter
                from urllib3.util.retry import Retry
                
                # Настраиваем SSL-контекст для современных сертификатов
                ssl_context = ssl.create_default_context()
                ssl_context.check_hostname = True
                ssl_context.verify_mode = ssl.CERT_REQUIRED
                
                # Создаем сессию с retry-логикой
                session = requests.Session()
                
                # Настраиваем retry-стратегию для обработки временных SSL-ошибок
                retry_strategy = Retry(
                    total=3,
                    backoff_factor=1,
                    status_forcelist=[429, 500, 502, 503, 504],
                    allowed_methods=["POST"]
                )
                
                adapter = HTTPAdapter(max_retries=retry_strategy)
                session.mount("https://", adapter)
                
                try:
                    user_info_response = session.post(
                        'https://id.vk.ru/oauth2/user_info',
                        data={
                            'client_id': settings.VK_APP_ID,
                            'access_token': access_token
                        },
                        headers={
                            'Content-Type': 'application/x-www-form-urlencoded'
                        },
                        timeout=30,
                        verify=True
                    )
                except (requests.exceptions.SSLError, urllib3.exceptions.SSLError) as ssl_error:
                    logger.error(f"SSL Error during VK ID API call: {ssl_error}")
                    return Response(
                        {'error': 'SSL connection error with VK ID service'}, 
                        status=status.HTTP_503_SERVICE_UNAVAILABLE
                    )
                except requests.exceptions.RequestException as req_error:
                    logger.error(f"Request Error during VK ID API call: {req_error}")
                    return Response(
                        {'error': 'Failed to connect to VK ID service'}, 
                        status=status.HTTP_503_SERVICE_UNAVAILABLE
                    )
                
                if user_info_response.status_code != 200:
                    return Response(
                        {'error': 'Failed to get user info from VK ID'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                user_data = user_info_response.json()
                
                if 'error' in user_data:
                    return Response(
                        {'error': f"VK ID error: {user_data.get('error_description', 'Unknown VK ID error')}"}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # VK ID API возвращает данные в формате {user: {...}}
                vk_user_data = user_data.get('user', {})
                vk_user_id = vk_user_data.get('user_id')
                
                if not vk_user_id:
                    return Response(
                        {'error': 'User ID not found in VK ID response'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Формируем данные пользователя в нужном формате
                vk_user = {
                    'id': vk_user_id,
                    'first_name': vk_user_data.get('first_name', ''),
                    'last_name': vk_user_data.get('last_name', ''),
                    'photo_200': vk_user_data.get('avatar', ''),
                    'email': ''
                }
                
            else:
                # Стандартный OAuth код
                vk_params = {
                    'client_id': settings.VK_APP_ID,
                    'client_secret': settings.VK_APP_SECRET,
                    'redirect_uri': settings.VK_REDIRECT_URI,
                    'code': code,
                }
                print(f"VK OAuth token request params: {vk_params}")
                
                try:
                    vk_token_response = session.get(
                        'https://oauth.vk.com/access_token',
                        params=vk_params,
                        timeout=30,
                        verify=True
                    )
                except (requests.exceptions.SSLError, urllib3.exceptions.SSLError) as ssl_error:
                    logger.error(f"SSL Error during VK OAuth API call: {ssl_error}")
                    return Response(
                        {'error': 'SSL connection error with VK OAuth service'}, 
                        status=status.HTTP_503_SERVICE_UNAVAILABLE
                    )
                except requests.exceptions.RequestException as req_error:
                    logger.error(f"Request Error during VK OAuth API call: {req_error}")
                    return Response(
                        {'error': 'Failed to connect to VK OAuth service'}, 
                        status=status.HTTP_503_SERVICE_UNAVAILABLE
                    )
                
                print(f"VK token response status: {vk_token_response.status_code}")
                print(f"VK token response content: {vk_token_response.text}")
                
                if vk_token_response.status_code != 200:
                    return Response(
                        {'error': f'VK authentication failed: {vk_token_response.status_code} - {vk_token_response.text}'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                vk_data = vk_token_response.json()
                print(f"VK token response data: {vk_data}")
                
                if 'error' in vk_data:
                    return Response(
                        {'error': f"VK error: {vk_data.get('error_description', vk_data.get('error', 'Unknown VK error'))}"}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                access_token = vk_data['access_token']
                vk_user_id = vk_data['user_id']
                
                # Получаем информацию о пользователе от VK
                try:
                    user_info_response = session.get(
                        'https://api.vk.com/method/users.get',
                        params={
                            'user_ids': vk_user_id,
                            'fields': 'photo_200,email',
                            'access_token': access_token,
                            'v': '5.131'
                        },
                        timeout=30,
                        verify=True
                    )
                except (requests.exceptions.SSLError, urllib3.exceptions.SSLError) as ssl_error:
                    logger.error(f"SSL Error during VK API call: {ssl_error}")
                    return Response(
                        {'error': 'SSL connection error with VK API service'}, 
                        status=status.HTTP_503_SERVICE_UNAVAILABLE
                    )
                except requests.exceptions.RequestException as req_error:
                    logger.error(f"Request Error during VK API call: {req_error}")
                    return Response(
                        {'error': 'Failed to connect to VK API service'}, 
                        status=status.HTTP_503_SERVICE_UNAVAILABLE
                    )
                
                if user_info_response.status_code != 200:
                    return Response(
                        {'error': 'Failed to get user info from VK'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                user_data = user_info_response.json()
                
                if 'error' in user_data:
                    return Response(
                        {'error': user_data['error']['error_msg']}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                vk_user = user_data['response'][0]
            
            # Создаем или обновляем пользователя
            user, created = UserProfile.objects.get_or_create(
                vk_id=vk_user_id,
                defaults={
                    'name': f"{vk_user.get('first_name', '')} {vk_user.get('last_name', '')}".strip(),
                    'avatar_url': vk_user.get('photo_200', ''),
                    'email': '',
                }
            )
            
            if not created:
                # Обновляем данные существующего пользователя
                user.name = f"{vk_user.get('first_name', '')} {vk_user.get('last_name', '')}".strip()
                user.avatar_url = vk_user.get('photo_200', '')
                user.save()
            
            # Создаем JWT токены
            refresh = RefreshToken.for_user(user)
            
            logger.info(f"VK Auth successful for user: {user.name} (ID: {user.id})")
            
            return Response({
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': UserProfileSerializer(user).data
            })
            
        except Exception as e:
            logger.error(f"VK Auth error: {str(e)}")
            return Response(
                {'error': f'Authentication error: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CustomTokenRefreshView(TokenRefreshView):
    """Обновление JWT токенов"""
    permission_classes = [AllowAny]  # Разрешаем доступ без аутентификации для обновления токенов
    authentication_classes = []  # Отключаем аутентификацию для этого view


@api_view(['GET'])
@permission_classes([AllowAny])  # Отключаем глобальные permission classes
@require_authentication
def user_profile(request):
    """Получение профиля текущего пользователя"""
    serializer = UserProfileSerializer(request.user)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([AllowAny])  # Отключаем глобальные permission classes
@require_authentication
def user_roles(request):
    """Получение ролей пользователя"""
    roles = UserRole.objects.filter(user=request.user).select_related('eventum', 'user')
    serializer = UserRoleSerializer(roles, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([AllowAny])  # Отключаем глобальные permission classes
@require_authentication
def user_eventums(request):
    """Получение eventum'ов пользователя (где он имеет какую-либо роль)"""
    logger.info(f"user_eventums called by user: {request.user} (ID: {request.user.id})")
    
    try:
        # Получаем все роли организатора пользователя
        organizer_roles = UserRole.objects.filter(user=request.user, role='organizer').select_related('eventum')
        logger.info(f"Found {organizer_roles.count()} organizer roles for user {request.user.id}")
        
        # Получаем все участия пользователя как участника
        participant_eventums = Participant.objects.filter(user=request.user).select_related('eventum')
        logger.info(f"Found {participant_eventums.count()} participant roles for user {request.user.id}")
        
        # Создаем список eventum'ов с информацией о роли пользователя
        eventums_data = []
        
        # Добавляем eventum'ы где пользователь организатор
        for role in organizer_roles:
            eventum_data = EventumSerializer(role.eventum).data
            eventum_data['user_role'] = 'organizer'
            eventum_data['role_id'] = role.id
            eventums_data.append(eventum_data)
            logger.info(f"Added eventum {role.eventum.name} with role organizer")
        
        # Добавляем eventum'ы где пользователь участник
        for participant in participant_eventums:
            # Проверяем, не добавлен ли уже этот eventum как организатор
            if not any(e['id'] == participant.eventum.id for e in eventums_data):
                eventum_data = EventumSerializer(participant.eventum).data
                eventum_data['user_role'] = 'participant'
                eventum_data['role_id'] = participant.id
                eventums_data.append(eventum_data)
                logger.info(f"Added eventum {participant.eventum.name} with role participant")
        
        logger.info(f"Returning {len(eventums_data)} eventums")
        return Response(eventums_data)
        
    except Exception as e:
        logger.error(f"Error in user_eventums: {str(e)}")
        return Response({'error': f'Internal server error: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)






@api_view(['GET'])
@permission_classes([AllowAny])
def dev_user_auth(request):
    """Получение пользователя разработчика для локального режима"""
    # Проверяем, что это локальный режим разработки
    if not settings.DEBUG:
        return Response({'error': 'This endpoint is only available in development mode'}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        # Ищем пользователя разработчика по vk_id
        dev_user = UserProfile.objects.get(vk_id=999999999)
        
        # Создаем JWT токены для пользователя разработчика
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(dev_user)
        
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserProfileSerializer(dev_user).data
        })
        
    except UserProfile.DoesNotExist:
        return Response(
            {'error': 'Development user not found. Please create a user with vk_id=999999999'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {'error': f'Error authenticating dev user: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def check_slug_availability(request, slug):
    """Проверка доступности slug для eventum"""
    try:
        # Проверяем, существует ли eventum с таким slug
        eventum_exists = Eventum.objects.filter(slug=slug).exists()
        
        return Response({
            'available': not eventum_exists,
            'slug': slug
        })
        
    except Exception as e:
        return Response(
            {'error': f'Error checking slug availability: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def eventum_details(request, slug=None):
    """Получение детальной информации о eventum"""
    try:
        # Используем новую утилиту для получения eventum
        eventum = get_eventum_from_request(request, kwargs={'slug': slug})
        
        # Проверяем права доступа: только участники и организаторы могут просматривать eventum
        from .auth_utils import get_user_role_in_eventum
        if request.user.is_authenticated:
            user_role = get_user_role_in_eventum(request.user, eventum)
            # Если пользователь не является участником и не является организатором, возвращаем 403
            if user_role not in ['organizer', 'participant']:
                return Response(
                    {'error': 'Access denied. You must be a participant or organizer to view this eventum.'}, 
                    status=status.HTTP_403_FORBIDDEN
                )
            is_organizer = user_role == 'organizer'
        else:
            # Неаутентифицированные пользователи не имеют доступа
            return Response(
                {'error': 'Access denied. You must be a participant or organizer to view this eventum.'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Базовые данные eventum доступны только участникам и организаторам
        eventum_data = EventumSerializer(eventum).data
        
        # Если пользователь организатор, добавляем расширенную информацию
        if is_organizer:
            # Получаем статистику
            participants_count = Participant.objects.filter(eventum=eventum).count()
            events_count = Event.objects.filter(eventum=eventum).count()
            
            # Получаем организаторов
            organizer_roles = UserRole.objects.filter(
                eventum=eventum, 
                role='organizer'
            ).select_related('user')
            
            organizers_data = []
            for role in organizer_roles:
                organizers_data.append({
                    'id': role.id,
                    'user': UserProfileSerializer(role.user).data,
                    'eventum': eventum.id,
                    'role': role.role,
                    'created_at': role.created_at.isoformat()
                })
            
            eventum_data.update({
                'participants_count': participants_count,
                'events_count': events_count,
                'organizers': organizers_data
            })
        else:
            # Для неаутентифицированных пользователей или не-организаторов
            # показываем только базовую информацию без статистики и организаторов
            eventum_data.update({
                'participants_count': None,
                'events_count': None,
                'organizers': []
            })
        
        return Response(eventum_data)
        
    except Exception as e:
        logger.error(f"Error in eventum_details for slug '{slug}': {str(e)}", exc_info=True)
        return Response(
            {'error': f'Error getting eventum details: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@require_eventum_role('organizer')
def eventum_registration_stats(request, slug=None):
    """Получение статистики о зарегистрированных участниках"""
    eventum = request.eventum
    
    # Подсчитываем количество участников, которые зарегистрировались хотя бы на одно мероприятие
    # Подсчитываем уникальных участников, зарегистрированных на мероприятия через новую схему
    # Для типа button: участники в event_group_v2
    # Для типа application: участники в applicants
    from django.db.models import Count
    button_participants = Participant.objects.filter(
        eventum=eventum,
        group_v2_relations__group__event_relations__event__registration__registration_type=EventRegistration.RegistrationType.BUTTON,
        group_v2_relations__relation_type=ParticipantGroupV2ParticipantRelation.RelationType.INCLUSIVE
    ).distinct()
    
    application_participants = Participant.objects.filter(
        eventum=eventum,
        event_applications__registration__registration_type=EventRegistration.RegistrationType.APPLICATION
    ).distinct()
    
    # Объединяем и считаем уникальных
    registered_participants_count = (button_participants | application_participants).distinct().count()
    
    return Response({
        'registered_participants_count': registered_participants_count
    })


@api_view(['POST'])
@require_eventum_role('organizer')
def upload_image(request, eventum_slug=None):
    """Загрузка изображения в Yandex Object Storage. Возвращает публичный URL."""
    file_obj = request.FILES.get('file') or request.FILES.get('image')
    if not file_obj:
        return Response({'error': 'No file provided (expected field "file" or "image")'}, status=status.HTTP_400_BAD_REQUEST)

    bucket = getattr(settings, 'YC_S3_BUCKET_NAME', None)
    access_key = getattr(settings, 'AWS_ACCESS_KEY_ID', None)
    secret_key = getattr(settings, 'AWS_SECRET_ACCESS_KEY', None)
    endpoint_url = getattr(settings, 'YC_S3_ENDPOINT_URL', 'https://storage.yandexcloud.net')
    region_name = getattr(settings, 'YC_S3_REGION', 'ru-central1')

    if not all([bucket, access_key, secret_key]):
        return Response({'error': 'S3 storage is not configured'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # Генерируем путь: eventum/<slug>/images/<uuid>.<ext>
    import uuid as _uuid
    original_name = getattr(file_obj, 'name', 'upload')
    ext = ''
    if '.' in original_name:
        ext = original_name.rsplit('.', 1)[-1].lower()
    key = f"eventum/{eventum_slug}/images/{_uuid.uuid4().hex}{('.' + ext) if ext else ''}"

    content_type = file_obj.content_type or mimetypes.guess_type(original_name)[0] or 'application/octet-stream'

    try:
        s3 = boto3.client(
            's3',
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region_name,
            config=Config(signature_version='s3v4')
        )

        s3.upload_fileobj(
            Fileobj=file_obj,
            Bucket=bucket,
            Key=key,
            ExtraArgs={
                'ACL': 'public-read',
                'ContentType': content_type,
                'CacheControl': 'public, max-age=31536000'
            }
        )

        public_url = f"{endpoint_url.rstrip('/')}/{bucket}/{key}"
        return Response({
            'url': public_url,
            'key': key,
            'content_type': content_type
        }, status=status.HTTP_201_CREATED)
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error(f"Image upload failed: {e}")
        return Response({'error': 'Upload failed'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET', 'POST'])
@require_eventum_role('organizer')
def eventum_organizers(request, slug=None):
    """Получение списка организаторов eventum и добавление нового организатора"""
    # eventum уже получен и проверен в декораторе
    eventum = request.eventum
    
    if request.method == 'GET':
        # Получение списка организаторов
        organizer_roles = UserRole.objects.filter(
            eventum=eventum, 
            role='organizer'
        ).select_related('user')
        
        organizers_data = []
        for role in organizer_roles:
            organizers_data.append({
                'id': role.id,
                'user': UserProfileSerializer(role.user).data,
                'eventum': eventum.id,
                'role': role.role,
                'created_at': role.created_at.isoformat()
            })
        
        return Response(organizers_data)
    
    elif request.method == 'POST':
        # Добавление нового организатора
        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'error': 'user_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            user = UserProfile.objects.get(id=user_id)
        except UserProfile.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Проверяем, не является ли пользователь уже организатором
        existing_role = UserRole.objects.filter(
            user=user, 
            eventum=eventum, 
            role='organizer'
        ).first()
        
        if existing_role:
            return Response({'error': 'User is already an organizer'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Создаем роль организатора
        role = UserRole.objects.create(
            user=user,
            eventum=eventum,
            role='organizer'
        )
        
        role_data = {
            'id': role.id,
            'user': UserProfileSerializer(user).data,
            'eventum': eventum.id,
            'role': role.role,
            'created_at': role.created_at.isoformat()
        }
        
        return Response(role_data, status=status.HTTP_201_CREATED)




@api_view(['DELETE'])
@require_eventum_role('organizer')
def remove_eventum_organizer(request, slug=None, role_id=None):
    """Удаление организатора из eventum"""
    eventum = request.eventum
    
    try:
        role = UserRole.objects.get(id=role_id, eventum=eventum, role='organizer')
    except UserRole.DoesNotExist:
        return Response({'error': 'Organizer role not found'}, status=status.HTTP_404_NOT_FOUND)
    
    # Проверяем, что не удаляем последнего организатора
    organizers_count = UserRole.objects.filter(eventum=eventum, role='organizer').count()
    if organizers_count <= 1:
        return Response({'error': 'Cannot remove the last organizer'}, status=status.HTTP_400_BAD_REQUEST)
    
    role.delete()
    return Response({'status': 'success'}, status=status.HTTP_200_OK)


class UserViewSet(viewsets.ModelViewSet):
    """ViewSet для управления пользователями"""
    queryset = UserProfile.objects.all()
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]  # Требуем аутентификации
    
    def get_queryset(self):
        """Возвращаем всех пользователей"""
        return UserProfile.objects.all()
    
    def create(self, request, *args, **kwargs):
        """Создание нового пользователя"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Проверяем, что пользователь с таким VK ID не существует
        vk_id = serializer.validated_data.get('vk_id')
        if UserProfile.objects.filter(vk_id=vk_id).exists():
            return Response(
                {'vk_id': ['Пользователь с таким VK ID уже существует']}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)


@api_view(['GET'])
@permission_classes([IsAuthenticated])  # Требуем аутентификации
def search_users(request):
    """Поиск пользователей для добавления в организаторы"""
    
    query = request.GET.get('q', '').strip()
    if len(query) < 2:
        return Response({'error': 'Query must be at least 2 characters'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        users = UserProfile.objects.filter(
            name__icontains=query
        )[:10]  # Ограничиваем до 10 результатов
        
        users_data = [UserProfileSerializer(user).data for user in users]
        return Response(users_data)
        
    except Exception as e:
        return Response(
            {'error': f'Error searching users: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
@log_execution_time("Генерация iCalendar файла")
def participant_calendar_ics(request, eventum_slug=None, participant_id=None):
    """Генерация iCalendar файла с мероприятиями участника (публичный endpoint)"""
    try:
        # Проверяем Accept заголовок - разрешаем text/calendar, application/calendar и */*
        accept_header = request.META.get('HTTP_ACCEPT', '')
        if accept_header and not any(accepted in accept_header for accepted in ['text/calendar', 'application/calendar', '*/*', 'text/html']):
            # Если клиент не принимает календарные типы, возвращаем ошибку
            return Response(
                {'error': 'Client does not accept calendar format'}, 
                status=status.HTTP_406_NOT_ACCEPTABLE
            )
        
        # Получаем eventum
        eventum = get_eventum_from_request(request, kwargs={'slug': eventum_slug})
        
        # Получаем ID участника из параметров запроса или пути
        if not participant_id:
            participant_id = request.GET.get('participant_id')
        
        if not participant_id:
            return Response({'error': 'participant_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Используем фиксированный интервал обновления 10 минут
        refresh_interval_minutes = 10
        
        # Получаем участника с предзагруженными группами и их тегами
        try:
            participant = Participant.objects.select_related('eventum').prefetch_related(
                'groups__tags'
            ).get(id=participant_id, eventum=eventum)
        except Participant.DoesNotExist:
            return Response({'error': f'Participant with ID {participant_id} not found in this eventum'}, status=status.HTTP_404_NOT_FOUND)
        
        # Получаем ID групп участника и их тегов для оптимизации запросов
        participant_groups = list(participant.groups.all())
        participant_group_ids = [g.id for g in participant_groups]
        participant_group_tag_ids = []
        for group in participant_groups:
            participant_group_tag_ids.extend([tag.id for tag in group.tags.all()])
        
        # Оптимизированный запрос: получаем только нужные события с минимальными prefetch
        from django.db.models import Q, Exists, OuterRef
        
        # Создаем подзапросы для проверки участия
        # Для новой схемы регистрации проверяем:
        # - Для типа button: участник в event_group_v2
        # - Для типа application: участник в applicants
        participant_registration_exists = Exists(
            Event.objects.filter(
                pk=OuterRef('pk')
            ).filter(
                Q(
                    registration__registration_type=EventRegistration.RegistrationType.BUTTON,
                    event_group_v2__participant_relations__participant_id=participant_id,
                    event_group_v2__participant_relations__relation_type=ParticipantGroupV2ParticipantRelation.RelationType.INCLUSIVE
                ) | Q(
                    registration__registration_type=EventRegistration.RegistrationType.APPLICATION,
                    registration__applicants__id=participant_id
                )
            )
        )
        
        participant_direct_exists = Exists(
            Event.objects.filter(
                pk=OuterRef('pk'),
                participants__id=participant_id
            )
        )
        
        participant_group_exists = Exists(
            Event.objects.filter(
                pk=OuterRef('pk'),
                groups__id__in=participant_group_ids
            )
        )
        
        participant_group_tag_exists = Exists(
            Event.objects.filter(
                pk=OuterRef('pk'),
                group_tags__id__in=participant_group_tag_ids
            )
        )
        
        # Основной запрос с фильтрацией на уровне SQL
        filtered_events = Event.objects.filter(
            eventum=eventum
        ).filter(
            # События для всех участников
            Q(participant_type=Event.ParticipantType.ALL) |
            # События по записи, где участник зарегистрирован (новая схема)
            Q(
                registration__registration_type=EventRegistration.RegistrationType.BUTTON,
                event_group_v2__participant_relations__participant_id=participant_id,
                event_group_v2__participant_relations__relation_type=ParticipantGroupV2ParticipantRelation.RelationType.INCLUSIVE
            ) |
            Q(
                registration__registration_type=EventRegistration.RegistrationType.APPLICATION,
                registration__applicants__id=participant_id
            ) |
            # События вручную с прямым назначением
            Q(participant_type=Event.ParticipantType.MANUAL, participants__id=participant_id) |
            # События вручную через группы участника
            Q(participant_type=Event.ParticipantType.MANUAL, groups__id__in=participant_group_ids) |
            # События вручную через теги групп участника
            Q(participant_type=Event.ParticipantType.MANUAL, group_tags__id__in=participant_group_tag_ids)
        ).select_related('eventum').prefetch_related(
            'tags',
            'group_tags', 
            'locations'
        ).distinct()
        
        # Проверяем кэш для этого участника
        cache_key = f"ical_calendar_{eventum.slug}_{participant_id}"
        cached_calendar = cache.get(cache_key)
        if cached_calendar:
            logger.info(f"iCalendar получен из кэша для участника {participant_id}")
            response = Response(cached_calendar, content_type='text/calendar; charset=utf-8')
            response['Content-Disposition'] = f'attachment; filename="eventum-{eventum.slug}-{participant.id}.ics"'
            response['Cache-Control'] = 'public, max-age=300'  # Кэшируем на 5 минут
            response['Access-Control-Allow-Origin'] = '*'
            response['Access-Control-Allow-Methods'] = 'GET'
            response['Access-Control-Allow-Headers'] = 'Content-Type'
            return response
        
        # Создаем iCalendar календарь
        cal = Calendar()
        cal.add('prodid', '-//Eventum//Eventum Calendar//RU')
        cal.add('version', '2.0')
        cal.add('calscale', 'GREGORIAN')
        cal.add('method', 'PUBLISH')
        cal.add('X-WR-CALNAME', f'{eventum.name} - {participant.name}')
        cal.add('X-WR-CALDESC', f'Календарь мероприятий для участника {participant.name}')
        
        # Добавляем рекомендуемый интервал обновления
        # Формат: PT{minutes}M означает "Period Time {minutes} Minutes"
        cal.add('REFRESH-INTERVAL', f'PT{refresh_interval_minutes}M')
        
        # Добавляем каждое мероприятие в календарь
        for event in filtered_events:
            ical_event = ICalEvent()
            
            # Уникальный ID события
            ical_event.add('uid', f'event-{event.id}-{eventum.slug}@eventum.local')
            
            # Название мероприятия
            ical_event.add('summary', event.name)
            
            # Описание мероприятия
            description_parts = []
            if event.description:
                description_parts.append(event.description)
            
            # Добавляем информацию о локациях с оптимизированным отображением
            if event.locations.exists():
                location_paths = []
                locations_data = []
                
                # Собираем данные о всех локациях
                for loc in event.locations.all():
                    # Получаем полный путь локации от корня до текущей локации
                    path = []
                    current = loc
                    while current:
                        path.insert(0, current.name)
                        current = current.parent
                    location_path = ', '.join(path)
                    
                    # Получаем адрес локации (с поиском по иерархии вверх)
                    address = None
                    current_for_address = loc
                    while current_for_address and not address:
                        if current_for_address.address:
                            address = current_for_address.address
                        current_for_address = current_for_address.parent
                    
                    locations_data.append({
                        'path': location_path,
                        'address': address,
                        'name': loc.name
                    })
                
                # Оптимизируем отображение - находим общие префиксы
                if len(locations_data) > 1:
                    # Находим общий префикс для всех путей (по словам, разделенным запятыми)
                    common_prefix_parts = []
                    if locations_data:
                        first_path_parts = locations_data[0]['path'].split(', ')
                        for i in range(len(first_path_parts)):
                            if all(loc['path'].startswith(', '.join(first_path_parts[:i+1])) for loc in locations_data):
                                common_prefix_parts = first_path_parts[:i+1]
                            else:
                                break
                    
                    common_prefix = ', '.join(common_prefix_parts) if common_prefix_parts else ""
                    
                    # Находим общий адрес (только если все адреса одинаковые и не пустые)
                    common_address = None
                    if locations_data and all(loc['address'] == locations_data[0]['address'] for loc in locations_data) and locations_data[0]['address']:
                        common_address = locations_data[0]['address']
                    
                    # Если нет общего адреса, но есть общий префикс, то общий адрес - это адрес от общего префикса
                    if not common_address and common_prefix:
                        # Находим адрес для общего префикса
                        prefix_parts = common_prefix.split(', ')
                        if len(prefix_parts) > 0:
                            # Находим локацию, соответствующую последней части префикса
                            for loc in event.locations.all():
                                if loc.name == prefix_parts[-1]:
                                    # Получаем адрес этой локации
                                    address = None
                                    current_for_address = loc
                                    while current_for_address and not address:
                                        if current_for_address.address:
                                            address = current_for_address.address
                                        current_for_address = current_for_address.parent
                                    if address:
                                        common_address = address
                                    break
                    
                    # Формируем оптимизированные строки
                    for loc_data in locations_data:
                        if common_prefix and loc_data['path'].startswith(common_prefix):
                            # Убираем общий префикс
                            remaining_path = loc_data['path'][len(common_prefix):].lstrip(', ')
                            if remaining_path:
                                path_to_show = remaining_path
                            else:
                                path_to_show = loc_data['name']
                        else:
                            path_to_show = loc_data['path']
                        
                        # Формируем строку с адресом
                        if loc_data['address'] and loc_data['address'] != common_address:
                            location_paths.append(f"{path_to_show} ({loc_data['address']})")
                        elif not common_address and loc_data['address']:
                            # Если нет общего адреса, но у этой локации есть адрес
                            location_paths.append(f"{path_to_show} ({loc_data['address']})")
                        else:
                            location_paths.append(path_to_show)
                    
                    # Добавляем общий префикс и адрес в начало, если они есть
                    if common_prefix or common_address:
                        prefix_parts = []
                        if common_prefix:
                            prefix_parts.append(common_prefix)
                        if common_address:
                            prefix_parts.append(f"({common_address})")
                        
                        if prefix_parts:
                            location_paths.insert(0, ' '.join(prefix_parts))
                else:
                    # Если только одна локация, отображаем как обычно
                    for loc_data in locations_data:
                        if loc_data['address']:
                            location_paths.append(f"{loc_data['path']} ({loc_data['address']})")
                        else:
                            location_paths.append(loc_data['path'])
                
                description_parts.append(f"Место: {'; '.join(location_paths)}")
            
            if description_parts:
                ical_event.add('description', '\n'.join(description_parts))
            
            # Время начала и окончания
            # Проверяем, является ли время строкой или объектом datetime
            if isinstance(event.start_time, str):
                start_time = timezone.make_aware(datetime.fromisoformat(event.start_time.replace('Z', '+00:00')))
            else:
                start_time = event.start_time
                
            if isinstance(event.end_time, str):
                end_time = timezone.make_aware(datetime.fromisoformat(event.end_time.replace('Z', '+00:00')))
            else:
                end_time = event.end_time
            
            ical_event.add('dtstart', start_time)
            ical_event.add('dtend', end_time)
            
            # Время создания и последнего изменения
            now = timezone.now()
            ical_event.add('dtstamp', now)
            ical_event.add('created', now)
            ical_event.add('last-modified', now)
            
            # Статус события
            ical_event.add('status', 'CONFIRMED')
            
            # Добавляем событие в календарь
            cal.add_component(ical_event)
        
        # Генерируем содержимое календаря
        calendar_content = cal.to_ical().decode('utf-8')
        
        # Кэшируем результат на 5 минут
        cache.set(cache_key, calendar_content, 300)
        logger.info(f"iCalendar сгенерирован и закэширован для участника {participant_id}")
        
        # Создаем HTTP ответ с правильными заголовками
        response = Response(calendar_content, content_type='text/calendar; charset=utf-8')
        
        # Безопасное имя файла (убираем специальные символы)
        safe_filename = f"eventum-{eventum.slug}-{participant.id}.ics"
        response['Content-Disposition'] = f'attachment; filename="{safe_filename}"'
        response['Cache-Control'] = 'public, max-age=300'  # Кэшируем на 5 минут
        response['Access-Control-Allow-Origin'] = '*'
        response['Access-Control-Allow-Methods'] = 'GET'
        response['Access-Control-Allow-Headers'] = 'Content-Type'
        
        return response
        
    except Exception as e:
        logger.error(f"Error generating iCalendar for participant: {str(e)}", exc_info=True)
        return Response(
            {'error': f'Error generating calendar: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def participant_calendar_webcal(request, eventum_slug=None):
    """Возвращает webcal ссылку для подписки на календарь участника"""
    try:
        # Получаем eventum
        eventum = get_eventum_from_request(request, kwargs={'slug': eventum_slug})
        
        # Получаем ID участника из параметров запроса
        participant_id = request.GET.get('participant_id')
        
        if not participant_id:
            return Response({'error': 'participant_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Используем фиксированный интервал обновления 10 минут
        refresh_interval_minutes = 10
        
        # Получаем участника по ID
        try:
            participant = Participant.objects.get(id=participant_id, eventum=eventum)
        except Participant.DoesNotExist:
            return Response({'error': f'Participant with ID {participant_id} not found in this eventum'}, status=status.HTTP_404_NOT_FOUND)
        
        # Получаем корректный публичный URL с учетом HTTPS
        try:
            base_url = build_public_base_url(request)
        except ValueError as config_error:
            logger.error(f"Invalid BASE_URL configuration: {config_error}")
            return Response(
                {'error': 'Invalid BASE_URL configuration'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # Создаем HTTPS ссылку на календарь
        webcal_url = f"{base_url}/api/eventums/{eventum_slug}/calendar/{participant.id}.ics"
        
        # Принудительно используем HTTPS для календарных ссылок
        webcal_url = webcal_url.replace('http://', 'https://')
        
        return Response({
            'webcal_url': webcal_url,
            'calendar_name': f'Мероприятия {eventum.name} - {participant.name}',
            'description': f'Календарь мероприятий для участника {participant.name}'
        })
        
    except Exception as e:
        logger.error(f"Error generating webcal URL for participant: {str(e)}", exc_info=True)
        return Response(
            {'error': f'Error generating webcal URL: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


