from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from rest_framework.exceptions import NotFound, ValidationError
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
            # Получаем access_token от VK
            vk_token_response = requests.get(
                'https://oauth.vk.com/access_token',
                params={
                    'client_id': settings.VK_APP_ID,
                    'client_secret': settings.VK_APP_SECRET,
                    'redirect_uri': settings.VK_REDIRECT_URI,
                    'code': code,
                }
            )
            
            if vk_token_response.status_code != 200:
                return Response(
                    {'error': 'VK authentication failed'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            vk_data = vk_token_response.json()
            
            if 'error' in vk_data:
                return Response(
                    {'error': vk_data['error_description']}, 
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
                    'email': vk_user.get('email', ''),
                }
            )
            
            if not created:
                # Обновляем данные существующего пользователя
                user.name = f"{vk_user.get('first_name', '')} {vk_user.get('last_name', '')}".strip()
                user.avatar_url = vk_user.get('photo_200', '')
                if vk_user.get('email'):
                    user.email = vk_user.get('email', '')
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

