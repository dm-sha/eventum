from rest_framework import viewsets
from .models import *
from .serializers import *

class EventumViewSet(viewsets.ModelViewSet):
    queryset = Eventum.objects.all()
    serializer_class = EventumSerializer
    lookup_field = 'slug'

class BaseEventumViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        return self.queryset.filter(eventum__slug=self.kwargs['eventum_slug'])

    def perform_create(self, serializer):
        eventum = Eventum.objects.get(slug=self.kwargs['eventum_slug'])
        serializer.save(eventum=eventum)

class ParticipantViewSet(BaseEventumViewSet):
    queryset = Participant.objects.all()
    serializer_class = ParticipantSerializer

class GroupViewSet(BaseEventumViewSet):
    queryset = Group.objects.all()
    serializer_class = GroupSerializer

class EventViewSet(BaseEventumViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer

class GroupTagViewSet(BaseEventumViewSet):
    queryset = GroupTag.objects.all()
    serializer_class = GroupTagSerializer

class EventTagViewSet(BaseEventumViewSet):
    queryset = EventTag.objects.all()
    serializer_class = EventTagSerializer
