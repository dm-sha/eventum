from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, NotFound
from django.shortcuts import get_object_or_404
from .models import Eventum, Participant, ParticipantGroup, GroupTag, Event, EventTag
from .serializers import (
    EventumSerializer, ParticipantSerializer, ParticipantGroupSerializer,
    GroupTagSerializer, EventSerializer, EventTagSerializer
)

class EventumViewSet(viewsets.ModelViewSet):
    queryset = Eventum.objects.all()
    serializer_class = EventumSerializer
    lookup_field = 'slug'

    @action(detail=True, methods=['post'])
    def verify_password(self, request, slug=None):
        eventum = self.get_object()
        password = request.data.get('password', '')
        if eventum.check_password(password):
            return Response({'verified': True})
        return Response({'verified': False}, status=400)

class EventumScopedViewSet:
    def get_eventum(self):
        eventum_slug = self.kwargs.get('eventum_slug')
        eventum = get_object_or_404(Eventum, slug=eventum_slug)
        
        # Verify password for write operations
        if self.request.method not in ('GET', 'HEAD', 'OPTIONS'):
            password = self.request.META.get('HTTP_X_EVENTUM_PASSWORD', '')
            if not eventum.check_password(password):
                raise PermissionDenied("Invalid eventum password")
        
        return eventum
    
    def get_queryset(self):
        eventum = self.get_eventum()
        return self.queryset.filter(eventum=eventum)
    
    def perform_create(self, serializer):
        eventum = self.get_eventum()
        serializer.save(eventum=eventum)

class ParticipantViewSet(EventumScopedViewSet, viewsets.ModelViewSet):
    queryset = Participant.objects.all()
    serializer_class = ParticipantSerializer

class ParticipantGroupViewSet(EventumScopedViewSet, viewsets.ModelViewSet):
    queryset = ParticipantGroup.objects.all()
    serializer_class = ParticipantGroupSerializer

class GroupTagViewSet(EventumScopedViewSet, viewsets.ModelViewSet):
    queryset = GroupTag.objects.all()
    serializer_class = GroupTagSerializer

class EventTagViewSet(EventumScopedViewSet, viewsets.ModelViewSet):
    queryset = EventTag.objects.all()
    serializer_class = EventTagSerializer

class EventViewSet(EventumScopedViewSet, viewsets.ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer

    @action(detail=False, methods=['get'])
    def upcoming(self, request, eventum_slug=None):
        eventum = self.get_eventum()
        now = timezone.now()
        events = Event.objects.filter(eventum=eventum, start_time__gte=now).order_by('start_time')
        serializer = self.get_serializer(events, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def past(self, request, eventum_slug=None):
        eventum = self.get_eventum()
        now = timezone.now()
        events = Event.objects.filter(eventum=eventum, end_time__lt=now).order_by('-start_time')
        serializer = self.get_serializer(events, many=True)
        return Response(serializer.data)

@api_view(['POST'])
def verify_eventum_password(request, slug):
    try:
        eventum = Eventum.objects.get(slug=slug)
    except Eventum.DoesNotExist:
        return Response(
            {'error': 'Eventum not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    password = request.data.get('password', '')
    if eventum.check_password(password):
        return Response({'verified': True})
    return Response(
        {'verified': False},
        status=status.HTTP_403_FORBIDDEN
    )
