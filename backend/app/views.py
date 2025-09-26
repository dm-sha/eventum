from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.conf import settings
import requests
import json
from .models import Eventum, Participant, ParticipantGroup, GroupTag, Event, EventTag, UserProfile, UserRole
from .serializers import (
    EventumSerializer, ParticipantSerializer, ParticipantGroupSerializer,
    GroupTagSerializer, EventSerializer, EventTagSerializer,
    UserProfileSerializer, UserRoleSerializer, VKAuthSerializer, CustomTokenObtainPairSerializer
)
from .permissions import IsEventumOrganizer, IsEventumParticipant, IsEventumOrganizerOrReadOnly, IsEventumOrganizerOrReadOnlyForList

class EventumViewSet(viewsets.ModelViewSet):
    queryset = Eventum.objects.all()
    serializer_class = EventumSerializer
    lookup_field = 'slug'
    permission_classes = [IsEventumOrganizerOrReadOnlyForList]  # Список - чтение, конкретный - только организаторы

class EventumScopedViewSet:
    def get_eventum(self):
        eventum_slug = self.kwargs.get('eventum_slug')
        eventum = get_object_or_404(Eventum, slug=eventum_slug)
        return eventum
    
    def get_queryset(self):
        eventum = self.get_eventum()
        return self.queryset.filter(eventum=eventum)
    
    def perform_create(self, serializer):
        eventum = self.get_eventum()
        serializer.save(eventum=eventum)

class ParticipantViewSet(EventumScopedViewSet, viewsets.ModelViewSet):
    queryset = Participant.objects.all()
    serializer_class = ParticipantSerializer
    permission_classes = [IsEventumOrganizerOrReadOnly]  # Организаторы CRUD, участники только чтение

class ParticipantGroupViewSet(EventumScopedViewSet, viewsets.ModelViewSet):
    queryset = ParticipantGroup.objects.all()
    serializer_class = ParticipantGroupSerializer
    permission_classes = [IsEventumOrganizerOrReadOnly]  # Организаторы CRUD, участники только чтение

class GroupTagViewSet(EventumScopedViewSet, viewsets.ModelViewSet):
    queryset = GroupTag.objects.all()
    serializer_class = GroupTagSerializer
    permission_classes = [IsEventumOrganizerOrReadOnly]  # Организаторы CRUD, участники только чтение

class EventTagViewSet(EventumScopedViewSet, viewsets.ModelViewSet):
    queryset = EventTag.objects.all()
    serializer_class = EventTagSerializer
    permission_classes = [IsEventumOrganizerOrReadOnly]  # Организаторы CRUD, участники только чтение

class EventViewSet(EventumScopedViewSet, viewsets.ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer
    permission_classes = [IsEventumOrganizerOrReadOnly]  # Организаторы CRUD, участники только чтение

    @action(detail=False, methods=['get'])
    def upcoming(self, request, eventum_slug=None):
        eventum = self.get_eventum()
        now = timezone.now()
        events = Event.objects.filter(eventum=eventum, start_time__gte=now).order_by('start_time')
        serializer = self.get_serializer(events, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def past(self, request, eventum_slug=None):
        eventum = self.get_eventum()
        now = timezone.now()
        events = Event.objects.filter(eventum=eventum, end_time__lt=now).order_by('-start_time')
        serializer = self.get_serializer(events, many=True)
        return Response(serializer.data)


# Аутентификация через VK
class VKAuthView(TokenObtainPairView):
    """Авторизация через VK ID"""
    serializer_class = CustomTokenObtainPairSerializer
    
    def post(self, request, *args, **kwargs):
        serializer = VKAuthSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        code = serializer.validated_data['code']
        
        try:
            # Проверяем, что пришло от фронтенда
            if code.startswith('vk2.a.'):
                # Это access_token от VK ID SDK (уже обмененный на фронтенде)
                access_token = code
                
                # Получаем информацию о пользователе через VK ID API
                user_info_response = requests.post(
                    'https://id.vk.ru/oauth2/user_info',
                    data={
                        'client_id': settings.VK_APP_ID,
                        'access_token': access_token
                    },
                    headers={
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
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
                
                vk_token_response = requests.get(
                    'https://oauth.vk.com/access_token',
                    params=vk_params
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
                user_info_response = requests.get(
                    'https://api.vk.com/method/users.get',
                    params={
                        'user_ids': vk_user_id,
                        'fields': 'photo_200,email',
                        'access_token': access_token,
                        'v': '5.131'
                    }
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
            
            return Response({
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': UserProfileSerializer(user).data
            })
            
        except Exception as e:
            return Response(
                {'error': f'Authentication error: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CustomTokenRefreshView(TokenRefreshView):
    """Обновление JWT токенов"""
    pass


@api_view(['GET'])
def user_profile(request):
    """Получение профиля текущего пользователя"""
    if not request.user.is_authenticated:
        return Response({'error': 'Not authenticated'}, status=status.HTTP_401_UNAUTHORIZED)
    
    serializer = UserProfileSerializer(request.user)
    return Response(serializer.data)


@api_view(['GET'])
def user_roles(request):
    """Получение ролей пользователя"""
    if not request.user.is_authenticated:
        return Response({'error': 'Not authenticated'}, status=status.HTTP_401_UNAUTHORIZED)
    
    roles = UserRole.objects.filter(user=request.user)
    serializer = UserRoleSerializer(roles, many=True)
    return Response(serializer.data)


@api_view(['GET'])
def user_events(request):
    """Получение мероприятий пользователя (где он организатор или участник)"""
    if not request.user.is_authenticated:
        return Response({'error': 'Not authenticated'}, status=status.HTTP_401_UNAUTHORIZED)
    
    # Получаем все eventum'ы, где пользователь имеет роль
    user_roles = UserRole.objects.filter(user=request.user)
    eventum_ids = [role.eventum.id for role in user_roles]
    
    # Получаем все мероприятия из этих eventum'ов
    events = Event.objects.filter(eventum_id__in=eventum_ids).order_by('-start_time')
    
    # Создаем расширенный сериализатор с информацией о роли пользователя
    events_data = []
    for event in events:
        event_data = EventSerializer(event).data
        
        # Находим роль пользователя в этом eventum'е
        user_role = user_roles.filter(eventum=event.eventum).first()
        event_data['user_role'] = user_role.role if user_role else None
        event_data['eventum_name'] = event.eventum.name
        event_data['eventum_slug'] = event.eventum.slug
        
        events_data.append(event_data)
    
    return Response(events_data)


@api_view(['POST'])
def create_event_with_organizer(request):
    """Создание нового мероприятия с автоматическим назначением пользователя организатором"""
    if not request.user.is_authenticated:
        return Response({'error': 'Not authenticated'}, status=status.HTTP_401_UNAUTHORIZED)
    
    # Получаем данные из запроса
    eventum_name = request.data.get('eventum_name')
    event_name = request.data.get('event_name')
    event_description = request.data.get('event_description', '')
    start_time = request.data.get('start_time')
    end_time = request.data.get('end_time')
    
    if not all([eventum_name, event_name, start_time, end_time]):
        return Response(
            {'error': 'Missing required fields: eventum_name, event_name, start_time, end_time'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        # Создаем или получаем eventum
        from django.utils.text import slugify
        eventum_slug = slugify(eventum_name)
        eventum, created = Eventum.objects.get_or_create(
            slug=eventum_slug,
            defaults={'name': eventum_name}
        )
        
        # Создаем мероприятие
        event = Event.objects.create(
            eventum=eventum,
            name=event_name,
            description=event_description,
            start_time=start_time,
            end_time=end_time
        )
        
        # Назначаем пользователя организатором, если он еще не имеет роли
        user_role, role_created = UserRole.objects.get_or_create(
            user=request.user,
            eventum=eventum,
            defaults={'role': 'organizer'}
        )
        
        # Если роль уже существовала, но была 'participant', обновляем на 'organizer'
        if not role_created and user_role.role == 'participant':
            user_role.role = 'organizer'
            user_role.save()
        
        # Возвращаем данные мероприятия с информацией о роли
        event_data = EventSerializer(event).data
        event_data['user_role'] = 'organizer'
        event_data['eventum_name'] = eventum.name
        event_data['eventum_slug'] = eventum.slug
        
        return Response(event_data, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response(
            {'error': f'Error creating event: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


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



