from rest_framework import serializers
from .models import Event, Participant

class ParticipantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Participant
        fields = ['id', 'name']

class EventSerializer(serializers.ModelSerializer):
    participants = ParticipantSerializer(many=True, read_only=True)
    
    class Meta:
        model = Event
        fields = ['id', 'title', 'start_date', 'end_date', 'participants']
