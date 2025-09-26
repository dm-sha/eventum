from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    EventumViewSet,
    ParticipantViewSet,
    ParticipantGroupViewSet,
    GroupTagViewSet,
    EventViewSet,
    EventTagViewSet,
    VKAuthView,
    CustomTokenRefreshView,
    user_profile,
    user_roles,
    vk_settings
)

router = DefaultRouter()
router.register(r'eventums', EventumViewSet)

eventum_scoped_router = DefaultRouter()
eventum_scoped_router.register(r'participants', ParticipantViewSet, basename='participant')
eventum_scoped_router.register(r'groups', ParticipantGroupViewSet, basename='participantgroup')
eventum_scoped_router.register(r'group-tags', GroupTagViewSet, basename='grouptag')
eventum_scoped_router.register(r'events', EventViewSet, basename='event')
eventum_scoped_router.register(r'event-tags', EventTagViewSet, basename='eventtag')

urlpatterns = [
    path('', include(router.urls)),
    path('eventums/<slug:eventum_slug>/', include(eventum_scoped_router.urls)),
    
    # Аутентификация
    path('auth/vk/', VKAuthView.as_view(), name='vk_auth'),
    path('auth/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),
    path('auth/profile/', user_profile, name='user_profile'),
    path('auth/roles/', user_roles, name='user_roles'),
    path('auth/vk-settings/', vk_settings, name='vk_settings'),
]
