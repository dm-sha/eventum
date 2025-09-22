from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    EventTagViewSet,
    EventViewSet,
    EventumViewSet,
    GroupTagViewSet,
    LoginView,
    MeView,
    ParticipantGroupViewSet,
    ParticipantViewSet,
    RefreshTokenView,
    RegisterView,
    UserEventumViewSet,
    verify_eventum_password,
)

router = DefaultRouter()
router.register(r'eventums', EventumViewSet, basename='eventum')

eventum_scoped_router = DefaultRouter()
eventum_scoped_router.register(r'participants', ParticipantViewSet, basename='participant')
eventum_scoped_router.register(r'groups', ParticipantGroupViewSet, basename='participantgroup')
eventum_scoped_router.register(r'group-tags', GroupTagViewSet, basename='grouptag')
eventum_scoped_router.register(r'events', EventViewSet, basename='event')
eventum_scoped_router.register(r'event-tags', EventTagViewSet, basename='eventtag')

dashboard_router = DefaultRouter()
dashboard_router.register(r'eventums', UserEventumViewSet, basename='dashboard-eventum')

urlpatterns = [
    path('auth/login/', LoginView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', RefreshTokenView.as_view(), name='token_refresh'),
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/me/', MeView.as_view(), name='me'),
    path('', include(router.urls)),
    path('eventums/<slug:eventum_slug>/', include(eventum_scoped_router.urls)),
    path('dashboard/', include(dashboard_router.urls)),
    path('api/eventums/<slug:slug>/verify-password/', verify_eventum_password, name='verify-password'),
]
