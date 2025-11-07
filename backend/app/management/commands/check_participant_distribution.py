from django.core.management.base import BaseCommand
from django.db.models import Count, Q
from app.models import (
    EventWave, EventRegistration, Participant,
    ParticipantGroupV2ParticipantRelation
)


class Command(BaseCommand):
    help = 'Проверяет распределение участников по мероприятиям в волнах'

    def add_arguments(self, parser):
        parser.add_argument(
            '--eventum-slug',
            type=str,
            help='Slug eventum\'а для проверки (если не указан, проверяются все eventum\'ы)'
        )
        parser.add_argument(
            '--wave-id',
            type=int,
            help='ID конкретной волны для проверки (если не указан, проверяются все волны)'
        )

    def handle(self, *args, **options):
        eventum_slug = options.get('eventum_slug')
        wave_id = options.get('wave_id')

        # Получаем волны для проверки
        waves_query = EventWave.objects.select_related('eventum').prefetch_related(
            'registrations__event',
            'registrations__event__event_group_v2',
            'registrations__applicants'
        )
        
        if eventum_slug:
            waves_query = waves_query.filter(eventum__slug=eventum_slug)
        
        if wave_id:
            waves_query = waves_query.filter(id=wave_id)
        
        waves = list(waves_query.all())
        
        if not waves:
            self.stdout.write(self.style.WARNING('Не найдено волн для проверки'))
            return

        self.stdout.write(f'Найдено волн: {len(waves)}\n')

        # 1. Находим участников, которые не попали на мероприятие хотя бы в одной волне, но заявка у них была
        self.stdout.write(self.style.SUCCESS('=' * 80))
        self.stdout.write(self.style.SUCCESS('1. Участники с заявками, но не попавшие на мероприятия'))
        self.stdout.write(self.style.SUCCESS('=' * 80))
        self._find_unassigned_participants(waves)

        # 2. Находим участников, которые попали на несколько мероприятий внутри одной волны
        self.stdout.write(self.style.SUCCESS('\n' + '=' * 80))
        self.stdout.write(self.style.SUCCESS('2. Участники, попавшие на несколько мероприятий в одной волне'))
        self.stdout.write(self.style.SUCCESS('=' * 80))
        self._find_multiple_assignments(waves)

    def _find_unassigned_participants(self, waves):
        """Находит участников, которые не попали на мероприятие хотя бы в одной волне, но заявка у них была"""
        found_any = False

        for wave in waves:
            # Получаем все регистрации типа APPLICATION в этой волне
            registrations = wave.registrations.filter(
                registration_type=EventRegistration.RegistrationType.APPLICATION
            ).select_related('event', 'event__event_group_v2').prefetch_related('applicants')

            if not registrations.exists():
                continue

            # Получаем все мероприятия этой волны с их группами
            events_in_wave = [reg.event for reg in registrations]
            event_groups = [event.event_group_v2 for event in events_in_wave if event.event_group_v2]

            if not event_groups:
                # Если нет групп, значит никто не распределен
                all_applicants = set()
                for reg in registrations:
                    all_applicants.update(reg.applicants.all())
                
                if all_applicants:
                    found_any = True
                    self.stdout.write(f'\nВолна: {wave.name} (eventum: {wave.eventum.name})')
                    self.stdout.write(f'  Всего заявок: {len(all_applicants)}')
                    self.stdout.write(f'  Участники с заявками, но не попавшие никуда:')
                    for participant in sorted(all_applicants, key=lambda p: p.name):
                        self.stdout.write(f'    - {participant.name} (ID: {participant.id})')
                continue

            # Получаем всех участников, которые попали хотя бы на одно мероприятие в этой волне
            assigned_participant_ids = set()
            for event_group in event_groups:
                participant_relations = ParticipantGroupV2ParticipantRelation.objects.filter(
                    group=event_group,
                    relation_type=ParticipantGroupV2ParticipantRelation.RelationType.INCLUSIVE
                ).values_list('participant_id', flat=True)
                assigned_participant_ids.update(participant_relations)

            # Находим участников с заявками, но не попавших никуда
            unassigned_participants = []
            for reg in registrations:
                for applicant in reg.applicants.all():
                    if applicant.id not in assigned_participant_ids:
                        # Проверяем, не добавили ли мы уже этого участника
                        if not any(p.id == applicant.id for p in unassigned_participants):
                            unassigned_participants.append(applicant)

            if unassigned_participants:
                found_any = True
                self.stdout.write(f'\nВолна: {wave.name} (eventum: {wave.eventum.name})')
                self.stdout.write(f'  Участники с заявками, но не попавшие никуда: {len(unassigned_participants)}')
                for participant in sorted(unassigned_participants, key=lambda p: p.name):
                    # Находим, на какие мероприятия была заявка
                    events_with_application = []
                    for reg in registrations:
                        if reg.applicants.filter(id=participant.id).exists():
                            events_with_application.append(reg.event.name)
                    
                    self.stdout.write(
                        f'    - {participant.name} (ID: {participant.id}) - '
                        f'заявки на: {", ".join(events_with_application)}'
                    )

        if not found_any:
            self.stdout.write(self.style.SUCCESS('  ✓ Все участники с заявками попали на мероприятия'))

    def _find_multiple_assignments(self, waves):
        """Находит участников, которые попали на несколько мероприятий внутри одной волны"""
        found_any = False

        for wave in waves:
            # Получаем все регистрации типа APPLICATION в этой волне
            registrations = wave.registrations.filter(
                registration_type=EventRegistration.RegistrationType.APPLICATION
            ).select_related('event', 'event__event_group_v2')

            if not registrations.exists():
                continue

            # Получаем все мероприятия этой волны с их группами
            events_with_groups = [
                (reg.event, reg.event.event_group_v2)
                for reg in registrations
                if reg.event.event_group_v2
            ]

            if len(events_with_groups) < 2:
                # Нужно минимум 2 мероприятия для проверки
                continue

            # Для каждого участника считаем, в скольких группах он есть
            participant_event_count = {}
            
            for event, event_group in events_with_groups:
                participant_ids = ParticipantGroupV2ParticipantRelation.objects.filter(
                    group=event_group,
                    relation_type=ParticipantGroupV2ParticipantRelation.RelationType.INCLUSIVE
                ).values_list('participant_id', flat=True)
                
                for participant_id in participant_ids:
                    if participant_id not in participant_event_count:
                        participant_event_count[participant_id] = []
                    participant_event_count[participant_id].append(event.name)

            # Находим участников, которые попали на несколько мероприятий
            multiple_assigned = {
                pid: events for pid, events in participant_event_count.items()
                if len(events) > 1
            }

            if multiple_assigned:
                found_any = True
                self.stdout.write(f'\nВолна: {wave.name} (eventum: {wave.eventum.name})')
                self.stdout.write(f'  Участников с несколькими назначениями: {len(multiple_assigned)}')
                
                for participant_id, event_names in sorted(multiple_assigned.items(), key=lambda x: len(x[1]), reverse=True):
                    try:
                        participant = Participant.objects.get(id=participant_id)
                        self.stdout.write(
                            f'    - {participant.name} (ID: {participant.id}) - '
                            f'попал на {len(event_names)} мероприятий: {", ".join(event_names)}'
                        )
                    except Participant.DoesNotExist:
                        self.stdout.write(
                            f'    - Участник ID: {participant_id} (не найден) - '
                            f'попал на {len(event_names)} мероприятий: {", ".join(event_names)}'
                        )

        if not found_any:
            self.stdout.write(self.style.SUCCESS('  ✓ Нет участников с несколькими назначениями в одной волне'))

