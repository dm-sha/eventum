from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    EventumViewSet,
    ParticipantViewSet,
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
    resolve_vk_user,
    participant_calendar_ics,
    participant_calendar_webcal,
    ParticipantGroupViewSet,
    ParticipantGroupParticipantRelationViewSet,
    ParticipantGroupGroupRelationViewSet,
    ParticipantGroupEventRelationViewSet,
    upload_image,
)
from .raw_views import (
    EventumRawBundleView,
    EventumRawEventRegistrationsView,
    EventumRawEventsView,
    EventumRawEventTagsView,
    EventumRawEventWavesView,
    EventumRawGroupEventRelationsView,
    EventumRawGroupGroupRelationsView,
    EventumRawGroupParticipantRelationsView,
    EventumRawGroupStructureView,
    EventumRawGroupsView,
    EventumRawLocationsView,
    EventumRawParticipantsView,
)

router = DefaultRouter()
router.register(r'eventums', EventumViewSet)
router.register(r'users', UserViewSet)

eventum_scoped_router = DefaultRouter()
eventum_scoped_router.register(r'participants', ParticipantViewSet, basename='participant')
eventum_scoped_router.register(r'groups', ParticipantGroupViewSet, basename='participantgroup')
eventum_scoped_router.register(r'participant-relations', ParticipantGroupParticipantRelationViewSet, basename='participantgroupparticipantrelation')
eventum_scoped_router.register(r'group-relations', ParticipantGroupGroupRelationViewSet, basename='participantgroupgrouprelation')
eventum_scoped_router.register(r'event-relations', ParticipantGroupEventRelationViewSet, basename='participantgroupeventrelation')
eventum_scoped_router.register(r'events', EventViewSet, basename='event')
eventum_scoped_router.register(r'event-tags', EventTagViewSet, basename='eventtag')
eventum_scoped_router.register(r'event-waves', EventWaveViewSet, basename='eventwave')
eventum_scoped_router.register(r'event-registrations', EventRegistrationViewSet, basename='eventregistration')
eventum_scoped_router.register(r'locations', LocationViewSet, basename='location')

urlpatterns = [
    # Поиск пользователей (должен быть ДО роутера users)
    path('users/search/', search_users, name='search_users'),
    path('users/resolve-vk/', resolve_vk_user, name='resolve_vk_user'),
    
    path('', include(router.urls)),
    
    # Основные маршруты с slug
    path('eventums/<slug:eventum_slug>/raw/bundle/', EventumRawBundleView.as_view(), name='eventum_raw_bundle'),
    path('eventums/<slug:eventum_slug>/raw/participants/', EventumRawParticipantsView.as_view(), name='eventum_raw_participants'),
    path('eventums/<slug:eventum_slug>/raw/events/', EventumRawEventsView.as_view(), name='eventum_raw_events'),
    path('eventums/<slug:eventum_slug>/raw/event-tags/', EventumRawEventTagsView.as_view(), name='eventum_raw_event_tags'),
    path('eventums/<slug:eventum_slug>/raw/locations/', EventumRawLocationsView.as_view(), name='eventum_raw_locations'),
    path('eventums/<slug:eventum_slug>/raw/event-registrations/', EventumRawEventRegistrationsView.as_view(), name='eventum_raw_event_registrations'),
    path('eventums/<slug:eventum_slug>/raw/event-waves/', EventumRawEventWavesView.as_view(), name='eventum_raw_event_waves'),
    path('eventums/<slug:eventum_slug>/raw/group-structure/', EventumRawGroupStructureView.as_view(), name='eventum_raw_group_structure'),
    path('eventums/<slug:eventum_slug>/raw/groups/', EventumRawGroupsView.as_view(), name='eventum_raw_groups'),
    path('eventums/<slug:eventum_slug>/raw/group-participant-relations/', EventumRawGroupParticipantRelationsView.as_view(), name='eventum_raw_group_participant_relations'),
    path('eventums/<slug:eventum_slug>/raw/group-group-relations/', EventumRawGroupGroupRelationsView.as_view(), name='eventum_raw_group_group_relations'),
    path('eventums/<slug:eventum_slug>/raw/group-event-relations/', EventumRawGroupEventRelationsView.as_view(), name='eventum_raw_group_event_relations'),
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
