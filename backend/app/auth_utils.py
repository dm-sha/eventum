"""
Утилиты для авторизации и работы с eventum
"""
from functools import wraps
from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework.response import Response
from rest_framework import status
from .models import Eventum, UserRole, Participant


def get_eventum_from_request(request, view=None, kwargs=None):
    """
    Функция для получения eventum из запроса по URL параметрам.
    Поддерживает кэширование результата в request.
    """
    # Проверяем кэш в request
    if hasattr(request, '_cached_eventum'):
        return request._cached_eventum
    
    # Получаем из URL параметров
    if view and hasattr(view, 'kwargs'):
        kwargs = view.kwargs
    elif kwargs is None:
        kwargs = getattr(request, 'resolver_match', {}).kwargs or {}
    
    # Пробуем разные варианты slug в URL
    eventum_slug = kwargs.get('eventum_slug') or kwargs.get('slug')
    
    if not eventum_slug:
        raise Http404("Eventum slug not found in URL")
    
    # Получаем eventum по slug
    try:
        eventum = Eventum.objects.get(slug=eventum_slug)
    except Eventum.DoesNotExist:
        raise Http404(f"Eventum with slug '{eventum_slug}' not found")
    
    # Кэшируем результат
    request._cached_eventum = eventum
    return eventum


def get_user_role_in_eventum(user, eventum):
    """
    Получить роль пользователя в eventum.
    Возвращает: 'organizer', 'participant', None
    """
    if not user or not user.is_authenticated:
        return None
    
    # Проверяем роль организатора
    if UserRole.objects.filter(user=user, eventum=eventum, role='organizer').exists():
        return 'organizer'
    
    # Проверяем участие
    if Participant.objects.filter(user=user, eventum=eventum).exists():
        return 'participant'
    
    return None


def require_authentication(view_func):
    """
    Декоратор для проверки аутентификации пользователя.
    Работает как с function-based views, так и с ViewSet методами.
    """
    @wraps(view_func)
    def wrapper(*args, **kwargs):
        # Определяем, это ViewSet метод или function-based view
        if len(args) > 0 and hasattr(args[0], 'request'):
            # ViewSet метод: первый аргумент - self, request в self.request
            request = args[0].request
        elif len(args) > 0:
            # Function-based view: первый аргумент - request
            request = args[0]
        else:
            # Не можем определить request
            return Response(
                {'error': 'Internal server error'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        if not request.user.is_authenticated:
            return Response(
                {'error': 'Authentication required'}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
        return view_func(*args, **kwargs)
    return wrapper


def require_eventum_role(required_roles):
    """
    Декоратор для проверки роли пользователя в eventum.
    required_roles: список ролей ['organizer', 'participant'] или строка 'organizer'
    Работает как с function-based views, так и с ViewSet методами.
    """
    if isinstance(required_roles, str):
        required_roles = [required_roles]
    
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(*args, **kwargs):
            # Определяем, это ViewSet метод или function-based view
            if len(args) > 0 and hasattr(args[0], 'request'):
                # ViewSet метод: первый аргумент - self, request в self.request
                view_instance = args[0]
                request = view_instance.request
                view = view_instance
            elif len(args) > 0:
                # Function-based view: первый аргумент - request
                request = args[0]
                view = None
            else:
                # Не можем определить request
                return Response(
                    {'error': 'Internal server error'}, 
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            if not request.user.is_authenticated:
                return Response(
                    {'error': 'Authentication required'}, 
                    status=status.HTTP_401_UNAUTHORIZED
                )
            
            try:
                eventum = get_eventum_from_request(request, view, kwargs)
                user_role = get_user_role_in_eventum(request.user, eventum)
                
                if user_role not in required_roles:
                    return Response(
                        {'error': 'Access denied'}, 
                        status=status.HTTP_403_FORBIDDEN
                    )
                
                # Добавляем eventum и роль в request для использования в view
                request.eventum = eventum
                request.user_role = user_role
                
                return view_func(*args, **kwargs)
                
            except Http404 as e:
                return Response(
                    {'error': str(e)}, 
                    status=status.HTTP_404_NOT_FOUND
                )
        return wrapper
    return decorator


class EventumMixin:
    """
    Миксин для работы с eventum в ViewSets и Views
    """
    
    def get_eventum(self):
        """Получить eventum для текущего запроса"""
        if not hasattr(self, '_cached_eventum'):
            self._cached_eventum = get_eventum_from_request(self.request, self)
        return self._cached_eventum
    
    def get_user_role(self):
        """Получить роль текущего пользователя в eventum"""
        if not hasattr(self, '_cached_user_role'):
            eventum = self.get_eventum()
            self._cached_user_role = get_user_role_in_eventum(self.request.user, eventum)
        return self._cached_user_role
    
    def is_organizer(self):
        """Проверить, является ли пользователь организатором"""
        return self.get_user_role() == 'organizer'
    
    def is_participant(self):
        """Проверить, является ли пользователь участником"""
        return self.get_user_role() in ['organizer', 'participant']


