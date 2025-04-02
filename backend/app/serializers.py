from rest_framework import serializers
from .models import *

class EventumSerializer(serializers.ModelSerializer):
    class Meta:
        model = Eventum
        fields = ['name', 'slug']

class ParticipantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Participant
        fields = ['id', 'name']

class GroupTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = GroupTag
        fields = ['id', 'name', 'slug']

class GroupSerializer(serializers.ModelSerializer):
    participants = ParticipantSerializer(many=True, read_only=True)
    tags = GroupTagSerializer(many=True, read_only=True)
    
    class Meta:
        model = Group
        fields = ['id', 'name', 'participants', 'tags']

class EventTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventTag
        fields = ['id', 'name', 'slug']

class EventSerializer(serializers.ModelSerializer):
    participants = ParticipantSerializer(many=True, read_only=True)
    groups = GroupSerializer(many=True, read_only=True)
    tags = EventTagSerializer(many=True, read_only=True)
    
    class Meta:
        model = Event
        fields = ['id', 'start_time', 'end_time', 'participants', 'groups', 'tags']
