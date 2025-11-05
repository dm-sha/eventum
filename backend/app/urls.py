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
    EventRegistrationViewSet,
    LocationViewSet,
    UserViewSet,
    VKAuthView,
    CustomTokenRefreshView,
    user_profile,
    user_roles,
    user_eventums,
    dev_user_auth,
    check_slug_availability,
    eventum_details,
    eventum_organizers,
    eventum_registration_stats,
    remove_eventum_organizer,
    search_users,
    participant_calendar_ics,
    participant_calendar_webcal,
    ParticipantGroupV2ViewSet,
    ParticipantGroupV2ParticipantRelationViewSet,
    ParticipantGroupV2GroupRelationViewSet,
    ParticipantGroupV2EventRelationViewSet,
    upload_image
)

router = DefaultRouter()
router.register(r'eventums', EventumViewSet)
router.register(r'users', UserViewSet)

eventum_scoped_router = DefaultRouter()
eventum_scoped_router.register(r'participants', ParticipantViewSet, basename='participant')
eventum_scoped_router.register(r'groups', ParticipantGroupViewSet, basename='participantgroup')
eventum_scoped_router.register(r'groups-v2', ParticipantGroupV2ViewSet, basename='participantgroupv2')
eventum_scoped_router.register(r'participant-relations-v2', ParticipantGroupV2ParticipantRelationViewSet, basename='participantgroupv2participantrelation')
eventum_scoped_router.register(r'group-relations-v2', ParticipantGroupV2GroupRelationViewSet, basename='participantgroupv2grouprelation')
eventum_scoped_router.register(r'event-relations-v2', ParticipantGroupV2EventRelationViewSet, basename='participantgroupv2eventrelation')
eventum_scoped_router.register(r'group-tags', GroupTagViewSet, basename='grouptag')
eventum_scoped_router.register(r'events', EventViewSet, basename='event')
eventum_scoped_router.register(r'event-tags', EventTagViewSet, basename='eventtag')
eventum_scoped_router.register(r'event-waves', EventWaveViewSet, basename='eventwave')
eventum_scoped_router.register(r'event-registrations', EventRegistrationViewSet, basename='eventregistration')
eventum_scoped_router.register(r'locations', LocationViewSet, basename='location')

urlpatterns = [
    # Поиск пользователей (должен быть ДО роутера users)
    path('users/search/', search_users, name='search_users'),
    
    path('', include(router.urls)),
    
    # Основные маршруты с slug
    path('eventums/<slug:eventum_slug>/', include(eventum_scoped_router.urls)),
    path('eventums/<slug:slug>/details/', eventum_details, name='eventum_details'),
    path('eventums/<slug:slug>/organizers/', eventum_organizers, name='eventum_organizers'),
    path('eventums/<slug:slug>/organizers/<int:role_id>/', remove_eventum_organizer, name='remove_eventum_organizer'),
    path('eventums/<slug:slug>/registration-stats/', eventum_registration_stats, name='eventum_registration_stats'),
    path('eventums/<slug:eventum_slug>/calendar.ics', participant_calendar_ics, name='participant_calendar_ics'),
    path('eventums/<slug:eventum_slug>/calendar/<int:participant_id>.ics', participant_calendar_ics, name='participant_calendar_ics_with_id'),
    path('eventums/<slug:eventum_slug>/calendar/webcal', participant_calendar_webcal, name='participant_calendar_webcal'),
    # Upload image endpoint
    path('eventums/<slug:eventum_slug>/upload-image/', upload_image, name='upload_image'),
    
    # Fallback для поддоменов (обратная совместимость)
    path('', include(eventum_scoped_router.urls)),
    
    # Аутентификация
    path('auth/vk/', VKAuthView.as_view(), name='vk_auth'),
    path('auth/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),
    path('auth/profile/', user_profile, name='user_profile'),
    path('auth/roles/', user_roles, name='user_roles'),
    path('auth/eventums/', user_eventums, name='user_eventums'),
    
    path('auth/dev-user/', dev_user_auth, name='dev_user_auth'),
    
    # Проверка доступности slug
    path('eventums/check-slug/<slug:slug>/', check_slug_availability, name='check_slug_availability'),
]
