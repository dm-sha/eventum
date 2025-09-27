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
    LocationViewSet,
    VKAuthView,
    CustomTokenRefreshView,
    user_profile,
    user_roles,
    user_eventums,
    dev_user_auth,
    check_slug_availability,
    eventum_details,
    eventum_organizers,
    add_eventum_organizer,
    remove_eventum_organizer,
    search_users
)

router = DefaultRouter()
router.register(r'eventums', EventumViewSet)

eventum_scoped_router = DefaultRouter()
eventum_scoped_router.register(r'participants', ParticipantViewSet, basename='participant')
eventum_scoped_router.register(r'groups', ParticipantGroupViewSet, basename='participantgroup')
eventum_scoped_router.register(r'group-tags', GroupTagViewSet, basename='grouptag')
eventum_scoped_router.register(r'events', EventViewSet, basename='event')
eventum_scoped_router.register(r'event-tags', EventTagViewSet, basename='eventtag')
eventum_scoped_router.register(r'locations', LocationViewSet, basename='location')

urlpatterns = [
    path('', include(router.urls)),
    path('eventums/<slug:eventum_slug>/', include(eventum_scoped_router.urls)),
    
    # Аутентификация
    path('auth/vk/', VKAuthView.as_view(), name='vk_auth'),
    path('auth/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),
    path('auth/profile/', user_profile, name='user_profile'),
    path('auth/roles/', user_roles, name='user_roles'),
    path('auth/eventums/', user_eventums, name='user_eventums'),
    
    path('auth/dev-user/', dev_user_auth, name='dev_user_auth'),
    
    # Проверка доступности slug
    path('eventums/check-slug/<slug:slug>/', check_slug_availability, name='check_slug_availability'),
    
    # Детальная информация о eventum
    path('eventums/<slug:slug>/details/', eventum_details, name='eventum_details'),
    
    # Управление организаторами
    path('eventums/<slug:slug>/organizers/', eventum_organizers, name='eventum_organizers'),
    path('eventums/<slug:slug>/organizers/', add_eventum_organizer, name='add_eventum_organizer'),
    path('eventums/<slug:slug>/organizers/<int:role_id>/', remove_eventum_organizer, name='remove_eventum_organizer'),
    
    # Поиск пользователей
    path('users/search/', search_users, name='search_users'),
]
