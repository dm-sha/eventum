from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import BasePermission
from .models import EventumToken, Eventum

class EventumTokenAuthentication(BaseAuthentication):
    def authenticate(self, request):
        token = request.META.get('HTTP_AUTHORIZATION', '').replace('Token ', '')
        if not token:
            return None
        try:
            eventum_token = EventumToken.objects.get(token=token)
            return (eventum_token.eventum, eventum_token)
        except EventumToken.DoesNotExist:
            raise AuthenticationFailed('Invalid token')

class IsEventumAuthorized(BasePermission):
    def has_permission(self, request, view):
        eventum_slug = view.kwargs.get('eventum_slug')
        if not eventum_slug:
            return False
        return request.user.slug == eventum_slug
