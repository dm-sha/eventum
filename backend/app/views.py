from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes, authentication_classes
from rest_framework.response import Response
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from django.shortcuts import get_object_or_404
from django.http import Http404
from django.utils import timezone
from django.conf import settings
from django.core.cache import cache
from django.db.models import Prefetch, Count
import requests
import json
from .models import Eventum, Participant, ParticipantGroup, GroupTag, Event, EventTag, UserProfile, UserRole, Location, EventWave, EventRegistration
from .serializers import (
    EventumSerializer, ParticipantSerializer, ParticipantGroupSerializer,
    GroupTagSerializer, EventSerializer, EventTagSerializer,
    UserProfileSerializer, UserRoleSerializer, VKAuthSerializer, CustomTokenObtainPairSerializer,
    LocationSerializer, EventWaveSerializer, EventRegistrationSerializer
)
from .permissions import IsEventumOrganizer, IsEventumParticipant, IsEventumOrganizerOrReadOnly, IsEventumOrganizerOrReadOnlyForList, IsEventumOrganizerOrPublicReadOnly
from .utils import log_execution_time, csrf_exempt_class_api
from .auth_utils import EventumMixin, require_authentication, require_eventum_role, get_eventum_from_request
from .base_views import EventumScopedViewSet, CachedListMixin
import logging

logger = logging.getLogger(__name__)

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
        """Получить заявки текущего участника на мероприятия"""
        eventum = self.get_eventum()
        
        try:
            participant = Participant.objects.get(user=request.user, eventum=eventum)
        except Participant.DoesNotExist:
            return Response({'error': 'User is not a participant in this eventum'}, status=status.HTTP_404_NOT_FOUND)
        
        # Получаем все заявки участника на мероприятия
        registrations = EventRegistration.objects.filter(
            participant=participant
        ).select_related('event').prefetch_related(
            'event__locations',
            'event__tags'
        ).order_by('-registered_at')
        
        serializer = EventRegistrationSerializer(registrations, many=True, context={'request': request})
        return Response(serializer.data)

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
    
    def perform_update(self, serializer):
        """Переопределяем для инвалидации кэша при обновлении"""
        super().perform_update(serializer)
        eventum_slug = self.kwargs.get('eventum_slug')
        cache_key = f"groups_list_{eventum_slug}"
        cache.delete(cache_key)
    
    def perform_destroy(self, instance):
        """Переопределяем для инвалидации кэша при удалении"""
        super().perform_destroy(instance)
        eventum_slug = self.kwargs.get('eventum_slug')
        cache_key = f"groups_list_{eventum_slug}"
        cache.delete(cache_key)

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

class EventTagViewSet(EventumScopedViewSet, viewsets.ModelViewSet):
    queryset = EventTag.objects.all()
    serializer_class = EventTagSerializer
    permission_classes = [IsEventumOrganizerOrPublicReadOnly]  # Организаторы CRUD, все остальные только чтение

class EventWaveViewSet(EventumScopedViewSet, viewsets.ModelViewSet):
    queryset = EventWave.objects.all()
    serializer_class = EventWaveSerializer
    permission_classes = [IsEventumOrganizerOrReadOnly]

    def get_queryset(self):
        eventum = self.get_eventum()
        return EventWave.objects.filter(eventum=eventum).select_related(
            'eventum', 'tag'
        ).prefetch_related(
            'whitelist_groups',
            'whitelist_group_tags',
            'blacklist_groups',
            'blacklist_group_tags',
            # Оптимизированные prefetch для событий волны с аннотациями
            Prefetch(
                'tag__events',
                queryset=Event.objects.select_related('eventum').prefetch_related(
                    'tags',
                    'registrations__participant',
                    'participants'
                ).annotate(
                    registrations_count=Count('registrations', distinct=True),
                    participants_count=Count('participants', distinct=True)
                )
            ),
        )

    @action(detail=True, methods=['post'], permission_classes=[IsEventumParticipant])
    def check_availability(self, request, eventum_slug=None, pk=None):
        """
        Проверяет доступность волны для участника.
        Ожидает participant_id в теле запроса.
        """
        try:
            participant_id = request.data.get('participant_id')
            if not participant_id:
                return Response(
                    {'error': 'participant_id is required'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Получаем волну и участника
            wave = self.get_object()
            participant = get_object_or_404(
                Participant, 
                id=participant_id, 
                eventum=wave.eventum
            )
            
            # Проверяем доступность
            is_available = wave.is_available_for_participant(participant)
            
            return Response({
                'is_available': is_available,
                'participant_id': participant_id,
                'wave_id': wave.id,
                'wave_name': wave.name
            })
            
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@csrf_exempt_class_api
class EventViewSet(EventumScopedViewSet, viewsets.ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer
    permission_classes = [IsEventumOrganizerOrPublicReadOnly]  # Организаторы CRUD, все остальные только чтение
    
    def get_queryset(self):
        """Оптимизированный queryset для списка событий с prefetch_related"""
        eventum = self.get_eventum()
        return Event.objects.filter(eventum=eventum).select_related(
            'eventum'
        ).prefetch_related(
            'participants',
            'participants__user',  # Нужно для is_registered
            'groups',
            'groups__tags',  # Нужно для сериализации групп
            'tags',  # Нужно для сериализации
            'group_tags',  # Нужно для сериализации
            'locations',  # Нужно для сериализации
            'registrations',  # Нужно для registrations_count и is_registered
            'registrations__participant',  # Нужно для is_registered
            'registrations__participant__user',  # Нужно для is_registered
        )


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
        """Подать заявку на мероприятие"""
        eventum = self.get_eventum()
        event = self.get_object()
        
        # Получаем участника
        participant, error_response = self._get_participant(request, eventum)
        if error_response:
            return error_response
        
        # Проверяем, открыта ли регистрация
        if not eventum.registration_open:
            return Response({'error': 'Registration is currently closed'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Проверяем, что мероприятие имеет тип "По записи"
        if event.participant_type != Event.ParticipantType.REGISTRATION:
            return Response({'error': 'Registration is only available for events with registration type'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Проверяем, не записан ли уже участник
        if EventRegistration.objects.filter(participant=participant, event=event).exists():
            return Response({'error': 'Already registered for this event'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Создаем заявку на мероприятие
        EventRegistration.objects.create(participant=participant, event=event)
        return Response({'status': 'success', 'message': 'Successfully registered for event'}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], permission_classes=[IsEventumParticipant])
    def unregister(self, request, eventum_slug=None, pk=None):
        """Отписаться от мероприятия"""
        eventum = self.get_eventum()
        event = self.get_object()
        
        # Получаем участника
        participant, error_response = self._get_participant(request, eventum)
        if error_response:
            return error_response
        
        # Удаляем заявку
        deleted_count, _ = EventRegistration.objects.filter(participant=participant, event=event).delete()
        if deleted_count == 0:
            return Response({'error': 'Not registered for this event'}, status=status.HTTP_404_NOT_FOUND)
        
        return Response({'status': 'success', 'message': 'Successfully unregistered from event'}, status=status.HTTP_200_OK)





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
        
        # Если пользователь аутентифицирован, проверяем права организатора для расширенной информации
        from .auth_utils import get_user_role_in_eventum
        user_role = get_user_role_in_eventum(request.user, eventum) if request.user.is_authenticated else None
        is_organizer = user_role == 'organizer'
        
        # Базовые данные eventum всегда доступны
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
    registered_participants_count = EventRegistration.objects.filter(
        participant__eventum=eventum
    ).values('participant').distinct().count()
    
    return Response({
        'registered_participants_count': registered_participants_count
    })


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


