"""
Сырые read-only эндпоинты для eventum: только поля моделей и id связей,
без SerializerMethodField, подсчётов и разрешения графа групп на сервере.
"""

from rest_framework.response import Response
from rest_framework.views import APIView

from .auth_utils import get_eventum_from_request
from .models import (
    Event,
    EventRegistration,
    EventTag,
    EventWave,
    Location,
    Participant,
    ParticipantGroup,
    ParticipantGroupEventRelation,
    ParticipantGroupGroupRelation,
    ParticipantGroupParticipantRelation,
)
from .permissions import (
    IsEventumOrganizer,
    IsEventumOrganizerOrPublicReadOnly,
    IsEventumOrganizerOrReadOnly,
)


def build_eventum_raw_group_structure(eventum):
    """
    Полный снимок графа групп: только колонки таблиц.
    """
    return {
        'eventum_id': eventum.id,
        'groups': list(
            ParticipantGroup.objects.filter(eventum=eventum)
            .order_by('id')
            .values('id', 'name', 'is_event_group', 'visible_to_participants', 'description')
        ),
        'participant_relations': list(
            ParticipantGroupParticipantRelation.objects.filter(group__eventum=eventum)
            .order_by('id')
            .values('id', 'group_id', 'participant_id', 'relation_type')
        ),
        'group_relations': list(
            ParticipantGroupGroupRelation.objects.filter(group__eventum=eventum)
            .order_by('id')
            .values('id', 'group_id', 'target_group_id', 'relation_type')
        ),
        'event_relations': list(
            ParticipantGroupEventRelation.objects.filter(
                group__eventum=eventum, event__eventum=eventum
            )
            .order_by('id')
            .values('id', 'group_id', 'event_id')
        ),
    }


def raw_participants_list(eventum):
    """
    Участники без вычисления групп; поля профиля пользователя — для отображения в админке.
    """
    return list(
        Participant.objects.filter(eventum=eventum)
        .select_related('user')
        .order_by('id')
        .values(
            'id',
            'eventum_id',
            'user_id',
            'name',
            'user__id',
            'user__vk_id',
            'user__name',
            'user__avatar_url',
            'user__email',
            'user__date_joined',
            'user__last_login',
        )
    )


def raw_event_tags_list(eventum):
    return list(
        EventTag.objects.filter(eventum=eventum)
        .order_by('id')
        .values('id', 'eventum_id', 'name', 'slug')
    )


def raw_locations_list(eventum):
    return list(
        Location.objects.filter(eventum=eventum)
        .order_by('id')
        .values(
            'id',
            'eventum_id',
            'parent_id',
            'name',
            'slug',
            'kind',
            'address',
            'floor',
            'notes',
        )
    )


def raw_events_list(eventum):
    qs = (
        Event.objects.filter(eventum=eventum)
        .order_by('id')
        .prefetch_related('tags', 'locations', 'participants')
    )
    out = []
    for e in qs:
        out.append(
            {
                'id': e.id,
                'eventum_id': e.eventum_id,
                'name': e.name,
                'description': e.description,
                'start_time': e.start_time,
                'end_time': e.end_time,
                'image_url': e.image_url or '',
                'event_group_id': e.event_group_id,
                'tag_ids': sorted(t.id for t in e.tags.all()),
                'location_ids': sorted(loc.id for loc in e.locations.all()),
                'participant_ids': sorted(p.id for p in e.participants.all()),
            }
        )
    return out


def raw_event_registrations_list(eventum):
    qs = (
        EventRegistration.objects.filter(event__eventum=eventum)
        .select_related('event')
        .prefetch_related('applicants')
        .order_by('id')
    )
    out = []
    for r in qs:
        out.append(
            {
                'id': r.id,
                'event_id': r.event_id,
                'max_participants': r.max_participants,
                'allowed_group_id': r.allowed_group_id,
                'registration_type': r.registration_type,
                'applicant_ids': sorted(a.id for a in r.applicants.all()),
            }
        )
    return out


def raw_event_waves_list(eventum):
    qs = EventWave.objects.filter(eventum=eventum).order_by('id').prefetch_related('registrations')
    out = []
    for w in qs:
        out.append(
            {
                'id': w.id,
                'eventum_id': w.eventum_id,
                'name': w.name,
                'registration_ids': sorted(reg.id for reg in w.registrations.all()),
            }
        )
    return out


class EventumRawGroupStructureView(APIView):
    permission_classes = [IsEventumOrganizerOrReadOnly]

    def get(self, request, eventum_slug):
        eventum = get_eventum_from_request(request, kwargs={'eventum_slug': eventum_slug})
        return Response(build_eventum_raw_group_structure(eventum))


class EventumRawGroupsView(APIView):
    permission_classes = [IsEventumOrganizerOrReadOnly]

    def get(self, request, eventum_slug):
        eventum = get_eventum_from_request(request, kwargs={'eventum_slug': eventum_slug})
        qs = ParticipantGroup.objects.filter(eventum=eventum).order_by('id')
        if request.query_params.get('include_event_groups', 'false').lower() != 'true':
            qs = qs.filter(is_event_group=False)
        return Response(
            {'groups': list(qs.values('id', 'name', 'is_event_group', 'visible_to_participants', 'description'))}
        )


class EventumRawGroupParticipantRelationsView(APIView):
    permission_classes = [IsEventumOrganizerOrReadOnly]

    def get(self, request, eventum_slug):
        eventum = get_eventum_from_request(request, kwargs={'eventum_slug': eventum_slug})
        group_id = request.query_params.get('group_id')
        qs = (
            ParticipantGroupParticipantRelation.objects.filter(group__eventum=eventum)
            .order_by('id')
            .values('id', 'group_id', 'participant_id', 'relation_type')
        )
        if group_id:
            qs = qs.filter(group_id=group_id)
        return Response({'participant_relations': list(qs)})


class EventumRawGroupGroupRelationsView(APIView):
    permission_classes = [IsEventumOrganizerOrReadOnly]

    def get(self, request, eventum_slug):
        eventum = get_eventum_from_request(request, kwargs={'eventum_slug': eventum_slug})
        group_id = request.query_params.get('group_id')
        qs = (
            ParticipantGroupGroupRelation.objects.filter(group__eventum=eventum)
            .order_by('id')
            .values('id', 'group_id', 'target_group_id', 'relation_type')
        )
        if group_id:
            qs = qs.filter(group_id=group_id)
        return Response({'group_relations': list(qs)})


class EventumRawGroupEventRelationsView(APIView):
    permission_classes = [IsEventumOrganizerOrReadOnly]

    def get(self, request, eventum_slug):
        eventum = get_eventum_from_request(request, kwargs={'eventum_slug': eventum_slug})
        group_id = request.query_params.get('group_id')
        event_id = request.query_params.get('event_id')
        qs = (
            ParticipantGroupEventRelation.objects.filter(
                group__eventum=eventum, event__eventum=eventum
            )
            .order_by('id')
            .values('id', 'group_id', 'event_id')
        )
        if group_id:
            qs = qs.filter(group_id=group_id)
        if event_id:
            qs = qs.filter(event_id=event_id)
        return Response({'event_relations': list(qs)})


class EventumRawParticipantsView(APIView):
    permission_classes = [IsEventumOrganizerOrReadOnly]

    def get(self, request, eventum_slug):
        eventum = get_eventum_from_request(request, kwargs={'eventum_slug': eventum_slug})
        return Response({'participants': raw_participants_list(eventum)})


class EventumRawEventsView(APIView):
    permission_classes = [IsEventumOrganizerOrPublicReadOnly]

    def get(self, request, eventum_slug):
        eventum = get_eventum_from_request(request, kwargs={'eventum_slug': eventum_slug})
        return Response({'events': raw_events_list(eventum)})


class EventumRawEventTagsView(APIView):
    permission_classes = [IsEventumOrganizerOrPublicReadOnly]

    def get(self, request, eventum_slug):
        eventum = get_eventum_from_request(request, kwargs={'eventum_slug': eventum_slug})
        return Response({'event_tags': raw_event_tags_list(eventum)})


class EventumRawLocationsView(APIView):
    permission_classes = [IsEventumOrganizerOrPublicReadOnly]

    def get(self, request, eventum_slug):
        eventum = get_eventum_from_request(request, kwargs={'eventum_slug': eventum_slug})
        return Response({'locations': raw_locations_list(eventum)})


class EventumRawEventRegistrationsView(APIView):
    permission_classes = [IsEventumOrganizerOrReadOnly]

    def get(self, request, eventum_slug):
        eventum = get_eventum_from_request(request, kwargs={'eventum_slug': eventum_slug})
        return Response({'event_registrations': raw_event_registrations_list(eventum)})


class EventumRawEventWavesView(APIView):
    permission_classes = [IsEventumOrganizerOrReadOnly]

    def get(self, request, eventum_slug):
        eventum = get_eventum_from_request(request, kwargs={'eventum_slug': eventum_slug})
        return Response({'event_waves': raw_event_waves_list(eventum)})


class EventumRawBundleView(APIView):
    """
    Один ответ со всеми сырыми сущностями eventum (удобно для первичной загрузки админки).
    Только организаторы — иначе участник увидел бы чужие заявки и полный граф.
    """

    permission_classes = [IsEventumOrganizer]

    def get(self, request, eventum_slug):
        eventum = get_eventum_from_request(request, kwargs={'eventum_slug': eventum_slug})
        payload = {
            'group_structure': build_eventum_raw_group_structure(eventum),
            'participants': raw_participants_list(eventum),
            'event_tags': raw_event_tags_list(eventum),
            'locations': raw_locations_list(eventum),
            'events': raw_events_list(eventum),
            'event_registrations': raw_event_registrations_list(eventum),
            'event_waves': raw_event_waves_list(eventum),
        }
        return Response(payload)
