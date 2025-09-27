from rest_framework import permissions
from .models import UserRole, Participant


class IsEventumOrganizer(permissions.BasePermission):
    """
    Разрешение только для организаторов конкретного eventum'а
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Получаем eventum_slug из URL
        eventum_slug = view.kwargs.get('eventum_slug')
        if not eventum_slug:
            return False
        
        # Проверяем, является ли пользователь организатором этого eventum'а
        return UserRole.objects.filter(
            user=request.user,
            eventum__slug=eventum_slug,
            role='organizer'
        ).exists()


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
        eventum_slug = view.kwargs.get('slug')
        if not eventum_slug:
            return False
        
        return UserRole.objects.filter(
            user=request.user,
            eventum__slug=eventum_slug,
            role='organizer'
        ).exists()


class IsEventumParticipant(permissions.BasePermission):
    """
    Разрешение для участников или организаторов конкретного eventum'а
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Получаем eventum_slug из URL
        eventum_slug = view.kwargs.get('eventum_slug')
        if not eventum_slug:
            return False
        
        # Проверяем, является ли пользователь организатором
        is_organizer = UserRole.objects.filter(
            user=request.user,
            eventum__slug=eventum_slug,
            role='organizer'
        ).exists()
        
        # Проверяем, является ли пользователь участником (через модель Participant)
        is_participant = Participant.objects.filter(
            user=request.user,
            eventum__slug=eventum_slug
        ).exists()
        
        return is_organizer or is_participant


class IsEventumOrganizerOrReadOnly(permissions.BasePermission):
    """
    Разрешение: организаторы могут все, участники только чтение
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Получаем eventum_slug из URL
        eventum_slug = view.kwargs.get('eventum_slug')
        if not eventum_slug:
            return False
        
        # Проверяем, является ли пользователь организатором
        is_organizer = UserRole.objects.filter(
            user=request.user,
            eventum__slug=eventum_slug,
            role='organizer'
        ).exists()
        
        # Если пользователь организатор - разрешаем все
        if is_organizer:
            return True
        
        # Проверяем, является ли пользователь участником (через модель Participant)
        is_participant = Participant.objects.filter(
            user=request.user,
            eventum__slug=eventum_slug
        ).exists()
        
        # Если пользователь участник - разрешаем только чтение
        if is_participant:
            return request.method in permissions.SAFE_METHODS
        
        return False
