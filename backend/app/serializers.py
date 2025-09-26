from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import (
    Eventum, Participant, ParticipantGroup, 
    GroupTag, Event, EventTag, UserProfile, UserRole
)

class EventumSerializer(serializers.ModelSerializer):
    class Meta:
        model = Eventum
        fields = ['id', 'name', 'slug']
        read_only_fields = ['slug']

class ParticipantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Participant
        fields = ['id', 'name']

class GroupTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = GroupTag
        fields = ['id', 'name', 'slug']

class ParticipantGroupSerializer(serializers.ModelSerializer):
    participants = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Participant.objects.all()
    )
    tags = GroupTagSerializer(many=True, read_only=True)
    tag_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        write_only=True,
        source='tags',
        queryset=GroupTag.objects.all()
    )

    class Meta:
        model = ParticipantGroup
        fields = ['id', 'name', 'slug', 'participants', 'tags', 'tag_ids']

class EventTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventTag
        fields = ['id', 'name', 'slug']

class EventSerializer(serializers.ModelSerializer):
    participants = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Participant.objects.all()
    )
    groups = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=ParticipantGroup.objects.all()
    )
    tags = EventTagSerializer(many=True, read_only=True)
    tag_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        write_only=True,
        source='tags',
        queryset=EventTag.objects.all()
    )

    class Meta:
        model = Event
        fields = [
            'id', 'name', 'description', 'start_time', 'end_time',
            'participants', 'groups', 'tags', 'tag_ids'
        ]


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['id', 'vk_id', 'name', 'avatar_url', 'email', 'date_joined', 'last_login']
        read_only_fields = ['id', 'date_joined', 'last_login']


class UserRoleSerializer(serializers.ModelSerializer):
    user = UserProfileSerializer(read_only=True)
    eventum = EventumSerializer(read_only=True)
    
    class Meta:
        model = UserRole
        fields = ['id', 'user', 'eventum', 'role', 'created_at']
        read_only_fields = ['id', 'created_at']


class VKAuthSerializer(serializers.Serializer):
    """Сериализатор для авторизации через VK"""
    code = serializers.CharField()
    state = serializers.CharField(required=False)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Кастомный сериализатор для JWT токенов с дополнительными полями"""
    
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        
        # Добавляем дополнительные поля в токен
        token['vk_id'] = user.vk_id
        token['name'] = user.name
        token['avatar_url'] = user.avatar_url
        
        return token
    
    def validate(self, attrs):
        data = super().validate(attrs)
        
        # Добавляем информацию о пользователе в ответ
        data['user'] = UserProfileSerializer(self.user).data
        
        return data
