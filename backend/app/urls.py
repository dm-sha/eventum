from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    EventumViewSet,
    ParticipantViewSet,
    ParticipantGroupViewSet,
    GroupTagViewSet,
    EventViewSet,
    EventTagViewSet,
    verify_eventum_password
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
    path('api/eventums/<slug:slug>/verify-password/', verify_eventum_password, name='verify-password'),
]
