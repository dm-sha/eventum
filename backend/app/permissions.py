from rest_framework import permissions
from django.http import Http404
from .models import UserRole, Participant
from .auth_utils import get_eventum_from_request, get_user_role_in_eventum


class IsEventumOrganizer(permissions.BasePermission):
    """
    Разрешение только для организаторов конкретного eventum'а
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        try:
            eventum = get_eventum_from_request(request, view)
            user_role = get_user_role_in_eventum(request.user, eventum)
            return user_role == 'organizer'
        except Http404:
            return False


class IsEventumOrganizerOrReadOnlyForList(permissions.BasePermission):
    """
    Разрешение: для списка eventum'ов - только чтение, для конкретного eventum'а - только организаторы
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Для списка eventum'ов разрешаем только чтение
        if view.action == 'list':
            return request.method in permissions.SAFE_METHODS
        
        # Для создания eventum'а разрешаем всем аутентифицированным пользователям
        if view.action == 'create':
            return True
        
        # Для конкретного eventum'а проверяем права организатора
        try:
            eventum = get_eventum_from_request(request, view)
            user_role = get_user_role_in_eventum(request.user, eventum)
            return user_role == 'organizer'
        except Http404:
            return False


class IsEventumParticipant(permissions.BasePermission):
    """
    Разрешение для участников или организаторов конкретного eventum'а
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        try:
            eventum = get_eventum_from_request(request, view)
            user_role = get_user_role_in_eventum(request.user, eventum)
            return user_role in ['organizer', 'participant']
        except Http404:
            return False


class IsEventumOrganizerOrReadOnly(permissions.BasePermission):
    """
    Разрешение: организаторы могут все, участники только чтение
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        try:
            eventum = get_eventum_from_request(request, view)
            user_role = get_user_role_in_eventum(request.user, eventum)
            
            # Организаторы могут все
            if user_role == 'organizer':
                return True
            
            # Участники только чтение
            if user_role == 'participant':
                return request.method in permissions.SAFE_METHODS
            
            return False
        except Http404:
            return False


class IsEventumOrganizerOrPublicReadOnly(permissions.BasePermission):
    """
    Разрешение: организаторы могут все, все остальные только чтение
    """
    
    def has_permission(self, request, view):
        # Для чтения разрешаем всем
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Для записи требуем аутентификации
        if not request.user or not request.user.is_authenticated:
            return False
        
        try:
            eventum = get_eventum_from_request(request, view)
            user_role = get_user_role_in_eventum(request.user, eventum)
            return user_role == 'organizer'
        except Http404:
            return False
