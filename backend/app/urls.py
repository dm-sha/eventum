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
    EventWaveViewSet,
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
    remove_eventum_organizer,
    search_users,
    test_subdomain
)

router = DefaultRouter()
router.register(r'eventums', EventumViewSet)

eventum_scoped_router = DefaultRouter()
eventum_scoped_router.register(r'participants', ParticipantViewSet, basename='participant')
eventum_scoped_router.register(r'groups', ParticipantGroupViewSet, basename='participantgroup')
eventum_scoped_router.register(r'group-tags', GroupTagViewSet, basename='grouptag')
eventum_scoped_router.register(r'events', EventViewSet, basename='event')
eventum_scoped_router.register(r'event-tags', EventTagViewSet, basename='eventtag')
eventum_scoped_router.register(r'event-waves', EventWaveViewSet, basename='eventwave')
eventum_scoped_router.register(r'locations', LocationViewSet, basename='location')

urlpatterns = [
    path('', include(router.urls)),
    
    # Маршруты с slug для основного домена
    path('eventums/<slug:eventum_slug>/', include(eventum_scoped_router.urls)),
    path('eventums/<slug:slug>/details/', eventum_details, name='eventum_details'),
    path('eventums/<slug:slug>/organizers/', eventum_organizers, name='eventum_organizers'),
    path('eventums/<slug:slug>/organizers/<int:role_id>/', remove_eventum_organizer, name='remove_eventum_organizer'),
    
    # Маршруты без slug для поддоменов (будут обрабатываться middleware)
    path('', include(eventum_scoped_router.urls)),  # Для поддоменов
    path('', include(router.urls)),  # Для обновления eventum на поддоменах
    path('details/', eventum_details, name='eventum_details_subdomain'),
    path('organizers/', eventum_organizers, name='eventum_organizers_subdomain'),
    path('organizers/<int:role_id>/', remove_eventum_organizer, name='remove_eventum_organizer_subdomain'),
    
    # Аутентификация
    path('auth/vk/', VKAuthView.as_view(), name='vk_auth'),
    path('auth/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),
    path('auth/profile/', user_profile, name='user_profile'),
    path('auth/roles/', user_roles, name='user_roles'),
    path('auth/eventums/', user_eventums, name='user_eventums'),
    
    path('auth/dev-user/', dev_user_auth, name='dev_user_auth'),
    
    # Проверка доступности slug
    path('eventums/check-slug/<slug:slug>/', check_slug_availability, name='check_slug_availability'),
    
    # Тестовый endpoint для поддоменов
    path('test-subdomain/', test_subdomain, name='test_subdomain'),
    
    # Поиск пользователей
    path('users/search/', search_users, name='search_users'),
]
