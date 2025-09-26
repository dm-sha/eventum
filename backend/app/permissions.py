from rest_framework import permissions
from .models import UserRole


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
        
        # Проверяем, является ли пользователь участником или организатором этого eventum'а
        return UserRole.objects.filter(
            user=request.user,
            eventum__slug=eventum_slug,
            role__in=['organizer', 'participant']
        ).exists()


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
        
        # Проверяем, есть ли у пользователя роль в этом eventum'е
        user_role = UserRole.objects.filter(
            user=request.user,
            eventum__slug=eventum_slug
        ).first()
        
        if not user_role:
            return False
        
        # Если пользователь организатор - разрешаем все
        if user_role.role == 'organizer':
            return True
        
        # Если пользователь участник - разрешаем только чтение
        if user_role.role == 'participant':
            return request.method in permissions.SAFE_METHODS
        
        return False
