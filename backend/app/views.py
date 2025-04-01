from .models import Event, Participant
from .serializers import EventSerializer, ParticipantSerializer

from rest_framework import viewsets

class ParticipantViewSet(viewsets.ModelViewSet):
    queryset = Participant.objects.all()
    serializer_class = ParticipantSerializer

class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        # Optional filtering by participant
        participant_id = self.request.query_params.get('participant')
        if participant_id:
            queryset = queryset.filter(participants__id=participant_id)
        return queryset