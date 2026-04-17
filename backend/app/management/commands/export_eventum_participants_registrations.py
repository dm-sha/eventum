import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from app.models import EventRegistration, Eventum, Participant, ParticipantGroup
from app.utils import EventumGroupGraph


def build_participants_registrations_export(eventum):
    participants = list(Participant.objects.filter(eventum=eventum).order_by("id"))
    participants_map = {participant.id: participant for participant in participants}
    group_graph = EventumGroupGraph(eventum, participants_map=participants_map)

    participant_to_groups = {participant.id: [] for participant in participants}
    groups = (
        ParticipantGroup.objects.filter(eventum=eventum, is_event_group=False)
        .order_by("name", "id")
    )
    for group in groups:
        for participant_id in group_graph.get_participant_ids(group.id):
            if participant_id in participant_to_groups:
                participant_to_groups[participant_id].append(group.name)

    participant_to_events = {participant.id: [] for participant in participants}
    registrations = (
        EventRegistration.objects.filter(event__eventum=eventum)
        .select_related("event")
        .order_by("event__start_time", "event__id")
    )
    for registration in registrations:
        event_payload = {
            "event_id": registration.event_id,
            "event_name": registration.event.name,
            "registration_type": registration.registration_type,
        }
        # Учитываем только финально зачисленных участников:
        # участник должен состоять в event_group мероприятия.
        registered_participant_ids = group_graph.get_participant_ids(
            registration.event.event_group_id
        )

        for participant_id in registered_participant_ids:
            if participant_id in participant_to_events:
                participant_to_events[participant_id].append(event_payload.copy())

    result = []
    for participant in participants:
        groups_list = sorted(participant_to_groups.get(participant.id, []), key=str.lower)
        events_list = participant_to_events.get(participant.id, [])
        events_list.sort(key=lambda item: (item["event_name"].lower(), item["event_id"]))
        result.append(
            {
                "participant_id": participant.id,
                "full_name": participant.name,
                "groups": groups_list,
                "registered_events": events_list,
            }
        )

    return result


def build_events_with_allocated_participants(eventum):
    """
    Мероприятия с настройкой регистрации и участники, зачисленные в event_group
    (итоговое распределение).
    """
    participants = list(Participant.objects.filter(eventum=eventum).order_by("id"))
    participants_map = {participant.id: participant for participant in participants}
    group_graph = EventumGroupGraph(eventum, participants_map=participants_map)

    registrations = (
        EventRegistration.objects.filter(event__eventum=eventum)
        .select_related("event")
        .order_by("event__start_time", "event__id")
    )
    out = []
    for registration in registrations:
        event = registration.event
        participant_ids = sorted(
            group_graph.get_participant_ids(event.event_group_id),
            key=lambda pid: (
                participants_map[pid].name.lower() if pid in participants_map else "",
                pid,
            ),
        )
        allocated = []
        for pid in participant_ids:
            if pid in participants_map:
                p = participants_map[pid]
                allocated.append({"participant_id": p.id, "full_name": p.name})
        out.append(
            {
                "event_id": event.id,
                "event_name": event.name,
                "registration_id": registration.id,
                "registration_type": registration.registration_type,
                "allocated_participants": allocated,
            }
        )
    return out


class Command(BaseCommand):
    help = (
        "Экспорт JSON по eventum: по умолчанию участники (ФИО, группы без event_group, "
        "мероприятия с регистрацией, куда зачислены); при --layout events — мероприятия "
        "с регистрацией и зачислённые в event_group участники."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--eventum-slug",
            required=True,
            help="Slug eventum (например, spring-fest-2026)",
        )
        parser.add_argument(
            "--layout",
            choices=("participants", "events"),
            default="participants",
            help=(
                "participants — строка на участника; events — строка на мероприятие "
                "с регистрацией + список зачислённых в event_group."
            ),
        )
        parser.add_argument(
            "--output",
            required=False,
            help="Путь к JSON-файлу. Если не указан, JSON печатается в stdout.",
        )
        parser.add_argument(
            "--pretty",
            action="store_true",
            help="Форматировать JSON с отступами для удобного чтения.",
        )

    def handle(self, *args, **options):
        eventum_slug = options["eventum_slug"]
        layout = options["layout"]
        output = options.get("output")
        pretty = options["pretty"]

        try:
            eventum = Eventum.objects.get(slug=eventum_slug)
        except Eventum.DoesNotExist as error:
            raise CommandError(f"Eventum со slug '{eventum_slug}' не найден.") from error

        payload = {
            "eventum_id": eventum.id,
            "eventum_slug": eventum.slug,
            "eventum_name": eventum.name,
            "layout": layout,
        }
        if layout == "participants":
            payload["participants"] = build_participants_registrations_export(eventum)
        else:
            payload["events"] = build_events_with_allocated_participants(eventum)

        json_kwargs = {"ensure_ascii": False}
        if pretty:
            json_kwargs["indent"] = 2

        output_json = json.dumps(payload, **json_kwargs)

        if output:
            output_path = Path(output).expanduser()
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(output_json + "\n", encoding="utf-8")
            self.stdout.write(self.style.SUCCESS(f"JSON сохранен: {output_path}"))
            return

        self.stdout.write(output_json)
