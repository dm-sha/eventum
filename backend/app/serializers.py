from django.contrib.auth import authenticate, get_user_model
from rest_framework import serializers

from .models import (
    Eventum,
    EventumMembership,
    GroupTag,
    Event,
    EventTag,
    Participant,
    ParticipantGroup,
    UserProfile,
)


User = get_user_model()

class EventumSerializer(serializers.ModelSerializer):
    class Meta:
        model = Eventum
        fields = ["id", "name", "slug"]
        read_only_fields = ["slug"]


class EventumDashboardSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    password = serializers.CharField(write_only=True, required=True, min_length=4)

    class Meta:
        model = Eventum
        fields = ["id", "name", "slug", "role", "password", "created_at"]
        read_only_fields = ["slug", "role", "created_at"]

    def get_role(self, obj):
        request = self.context.get("request")
        if not request or request.user.is_anonymous:
            return None
        membership = obj.memberships.filter(user=request.user).first()
        return membership.role if membership else None

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        eventum = Eventum.objects.create(**validated_data)
        if password:
            eventum.set_password(password)
            eventum.save(update_fields=["password_hash"])
        return eventum


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ["organization", "phone"]


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "profile"]


class RegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["email", "password", "first_name", "last_name"]

    def create(self, validated_data):
        email = validated_data.get("email")
        user = User(
            username=email,
            email=email,
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
        )
        user.set_password(validated_data["password"])
        user.save()
        UserProfile.objects.create(user=user)
        return user


class EventumMembershipSerializer(serializers.ModelSerializer):
    eventum = EventumSerializer(read_only=True)

    class Meta:
        model = EventumMembership
        fields = ["id", "eventum", "role", "created_at"]


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = authenticate(
            username=attrs.get("username"),
            password=attrs.get("password"),
        )
        if not user:
            raise serializers.ValidationError("Неверные учетные данные")
        attrs["user"] = user
        return attrs

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
