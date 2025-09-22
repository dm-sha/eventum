from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework import generics, mixins, status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Eventum,
    EventumMembership,
    Event,
    EventTag,
    GroupTag,
    Participant,
    ParticipantGroup,
)
from .serializers import (
    EventSerializer,
    EventTagSerializer,
    EventumDashboardSerializer,
    EventumSerializer,
    GroupTagSerializer,
    LoginSerializer,
    ParticipantGroupSerializer,
    ParticipantSerializer,
    RegistrationSerializer,
    UserSerializer,
)
from .authentication import (
    ExpiredSignature,
    InvalidToken,
    decode_jwt,
    generate_token_pair,
)

class RegisterView(generics.CreateAPIView):
    serializer_class = RegistrationSerializer
    permission_classes = [AllowAny]


class MeView(generics.RetrieveAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        tokens = generate_token_pair(user)
        user_data = UserSerializer(user).data
        return Response({**tokens, "user": user_data})


class RefreshTokenView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response({"detail": "Refresh token required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            payload = decode_jwt(refresh_token)
        except ExpiredSignature:
            return Response({"detail": "Refresh token expired"}, status=status.HTTP_401_UNAUTHORIZED)
        except InvalidToken as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_401_UNAUTHORIZED)

        if payload.get("token_type") != "refresh":
            return Response({"detail": "Invalid token type"}, status=status.HTTP_401_UNAUTHORIZED)

        user_id = payload.get("user_id")
        if not user_id:
            return Response({"detail": "Invalid token payload"}, status=status.HTTP_401_UNAUTHORIZED)

        User = get_user_model()
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"detail": "User not found"}, status=status.HTTP_401_UNAUTHORIZED)

        tokens = generate_token_pair(user)
        return Response(tokens)


class EventumViewSet(viewsets.ReadOnlyModelViewSet):
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

        if self.request.method not in ('GET', 'HEAD', 'OPTIONS'):
            if not self.request.user.is_authenticated:
                raise PermissionDenied("Authentication required")

            membership = eventum.memberships.filter(user=self.request.user).first()
            if not membership or membership.role != EventumMembership.ROLE_ORGANIZER:
                raise PermissionDenied("Organizer permissions required")

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


class UserEventumViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    serializer_class = EventumDashboardSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Eventum.objects.filter(memberships__user=self.request.user).distinct()

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    def perform_create(self, serializer):
        eventum = serializer.save(created_by=self.request.user)
        EventumMembership.objects.update_or_create(
            eventum=eventum,
            user=self.request.user,
            defaults={"role": EventumMembership.ROLE_ORGANIZER, "invited_by": self.request.user},
        )

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
