from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from app.models import (
    Eventum, Participant, GroupTag, ParticipantGroup, ParticipantGroupV2,
    ParticipantGroupV2ParticipantRelation, ParticipantGroupV2GroupRelation,
    ParticipantGroupV2EventRelation, EventTag, Event, Location, EventWave,
    EventRegistration, EventRegistrationApplication, UserRole
)


class Command(BaseCommand):
    help = 'Создает полную копию всех данных eventum\'а с указанным слагом'

    def add_arguments(self, parser):
        parser.add_argument(
            'source_slug',
            type=str,
            help='Slug исходного eventum\'а для копирования'
        )
        parser.add_argument(
            'target_slug',
            type=str,
            nargs='?',
            help='Slug нового eventum\'а (если не указан, будет добавлен суффикс -copy)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Показать что будет скопировано без фактического создания записей'
        )

    def handle(self, *args, **options):
        source_slug = options['source_slug']
        target_slug = options.get('target_slug')
        dry_run = options['dry_run']

        # Получаем исходный eventum
        try:
            source_eventum = Eventum.objects.get(slug=source_slug)
        except Eventum.DoesNotExist:
            raise CommandError(f'Eventum с слагом "{source_slug}" не найден.')

        # Определяем slug для нового eventum
        if not target_slug:
            target_slug = f"{source_slug}-copy"
            # Если такой slug уже существует, добавляем номер
            counter = 1
            while Eventum.objects.filter(slug=target_slug).exists():
                target_slug = f"{source_slug}-copy-{counter}"
                counter += 1

        # Проверяем, не существует ли уже eventum с таким слагом
        if Eventum.objects.filter(slug=target_slug).exists():
            raise CommandError(
                f'Eventum с слагом "{target_slug}" уже существует. '
                'Используйте другой slug или удалите существующий eventum.'
            )

        self.stdout.write(
            self.style.SUCCESS(
                f'Копирование eventum: {source_eventum.name} ({source_slug}) -> {target_slug}'
            )
        )

        if dry_run:
            self.stdout.write(self.style.WARNING('РЕЖИМ ПРОВЕРКИ - записи не будут созданы'))

        # Словари для маппинга старых ID на новые
        mapping = {
            'eventum': None,
            'participants': {},
            'group_tags': {},
            'participant_groups': {},
            'participant_groups_v2': {},
            'event_tags': {},
            'locations': {},
            'events': {},
            'event_waves': {},
            'event_registrations': {},
        }

        # Выполняем копирование (транзакции обрабатываются внутри метода)
        try:
            self._copy_eventum_data(source_eventum, target_slug, mapping, dry_run)
            if dry_run:
                self.stdout.write(
                    self.style.WARNING(
                        f'\n✓ Проверка завершена (dry-run режим)'
                    )
                )
            else:
                target_eventum = mapping['eventum']
                self.stdout.write(
                    self.style.SUCCESS(
                        f'\n✓ Копирование завершено успешно!'
                        f'\n  Новый eventum: {target_eventum.name} ({target_slug})'
                    )
                )
        except Exception as e:
            if not dry_run or "Dry run" not in str(e):
                self.stdout.write(
                    self.style.ERROR(f'\n✗ Ошибка при копировании: {str(e)}')
                )
                raise

    def _copy_eventum_data(self, source_eventum, target_slug, mapping, dry_run):
        """Выполняет копирование данных eventum'а"""
        try:
            # 1. Создаем новый Eventum (вне транзакции для избежания блокировок)
            self.stdout.write('1. Создание нового Eventum...')
            if not dry_run:
                target_eventum = Eventum.objects.create(
                    name=f"{source_eventum.name} (копия)",
                    slug=target_slug,
                    description=source_eventum.description,
                    image_url=source_eventum.image_url,
                    registration_open=source_eventum.registration_open,
                    schedule_visible=source_eventum.schedule_visible,
                )
                # Принудительно обновляем из БД для получения ID
                target_eventum.refresh_from_db()
                mapping['eventum'] = target_eventum
                self.stdout.write(f'   ✓ Eventum создан: {target_eventum.name} (ID: {target_eventum.id})')
            else:
                self.stdout.write(f'   [DRY RUN] Создан бы Eventum: {target_slug}')
                # Создаем фиктивный объект для dry-run
                class FakeEventum:
                    def __init__(self, name, slug):
                        self.name = name
                        self.slug = slug
                mapping['eventum'] = FakeEventum(f"{source_eventum.name} (копия)", target_slug)

            # Остальные операции выполняем в транзакции
            with transaction.atomic():
                # 2. Копируем Locations (сначала без parent, потом с parent)
                self.stdout.write('2. Копирование Locations...')
                target_eventum = mapping['eventum']
                
                # Загружаем все локации одним запросом
                all_locations = list(Location.objects.filter(eventum=source_eventum))
                locations_without_parent = [loc for loc in all_locations if loc.parent_id is None]
                locations_with_parent = [loc for loc in all_locations if loc.parent_id is not None]
                
                # Копируем локации без родителя bulk операцией
                if not dry_run:
                    new_locations_no_parent = [
                        Location(
                            eventum=target_eventum,
                            name=loc.name,
                            slug=loc.slug,
                            kind=loc.kind,
                            address=loc.address,
                            floor=loc.floor,
                            notes=loc.notes,
                            parent=None,
                        )
                        for loc in locations_without_parent
                    ]
                    created_locations = Location.objects.bulk_create(new_locations_no_parent)
                    for old_loc, new_loc in zip(locations_without_parent, created_locations):
                        mapping['locations'][old_loc.id] = new_loc
                else:
                    for loc in locations_without_parent:
                        self.stdout.write(f'   [DRY RUN] Создана бы Location: {loc.name}')
                        mapping['locations'][loc.id] = loc

                # Копируем локации с родителем (может потребоваться несколько проходов)
                max_iterations = 10
                iteration = 0
                remaining_locations = locations_with_parent.copy()
                
                while remaining_locations and iteration < max_iterations:
                    iteration += 1
                    locations_to_copy = [
                        loc for loc in remaining_locations
                        if loc.parent_id in mapping['locations']
                    ]
                    
                    if not locations_to_copy:
                        break
                    
                    if not dry_run:
                        new_locations_with_parent = [
                            Location(
                                eventum=target_eventum,
                                name=loc.name,
                                slug=loc.slug,
                                kind=loc.kind,
                                address=loc.address,
                                floor=loc.floor,
                                notes=loc.notes,
                                parent=mapping['locations'][loc.parent_id],
                            )
                            for loc in locations_to_copy
                        ]
                        created_locations = Location.objects.bulk_create(new_locations_with_parent)
                        for old_loc, new_loc in zip(locations_to_copy, created_locations):
                            mapping['locations'][old_loc.id] = new_loc
                    else:
                        for loc in locations_to_copy:
                            self.stdout.write(f'   [DRY RUN] Создана бы Location: {loc.name}')
                            mapping['locations'][loc.id] = loc
                    
                    # Удаляем скопированные локации из списка
                    remaining_locations = [loc for loc in remaining_locations if loc not in locations_to_copy]

                # 3. Копируем Participants
                self.stdout.write('3. Копирование Participants...')
                participants = list(Participant.objects.filter(eventum=source_eventum))
                
                if not dry_run:
                    new_participants = [
                        Participant(
                            eventum=target_eventum,
                            user=p.user,  # Пользователи не копируются
                            name=p.name,
                        )
                        for p in participants
                    ]
                    created_participants = Participant.objects.bulk_create(new_participants)
                    for old_p, new_p in zip(participants, created_participants):
                        mapping['participants'][old_p.id] = new_p
                else:
                    for participant in participants:
                        self.stdout.write(f'   [DRY RUN] Создан бы Participant: {participant.name}')
                        mapping['participants'][participant.id] = participant

                # 4. Копируем GroupTags
                self.stdout.write('4. Копирование GroupTags...')
                group_tags = list(GroupTag.objects.filter(eventum=source_eventum))
                
                if not dry_run:
                    new_group_tags = [
                        GroupTag(
                            eventum=target_eventum,
                            name=tag.name,
                            slug=tag.slug,
                        )
                        for tag in group_tags
                    ]
                    created_tags = GroupTag.objects.bulk_create(new_group_tags)
                    for old_tag, new_tag in zip(group_tags, created_tags):
                        mapping['group_tags'][old_tag.id] = new_tag
                else:
                    for tag in group_tags:
                        self.stdout.write(f'   [DRY RUN] Создан бы GroupTag: {tag.name}')
                        mapping['group_tags'][tag.id] = tag

                # 5. Копируем ParticipantGroups (старая версия)
                self.stdout.write('5. Копирование ParticipantGroups (старая версия)...')
                groups = list(ParticipantGroup.objects.filter(eventum=source_eventum)
                             .prefetch_related('participants', 'tags'))
                
                if not dry_run:
                    new_groups = [
                        ParticipantGroup(
                            eventum=target_eventum,
                            name=group.name,
                            slug=group.slug,
                        )
                        for group in groups
                    ]
                    created_groups = ParticipantGroup.objects.bulk_create(new_groups)
                    
                    # Сохраняем маппинг
                    for old_group, new_group in zip(groups, created_groups):
                        mapping['participant_groups'][old_group.id] = new_group
                    
                    # Копируем связи many-to-many через through таблицы
                    ParticipantGroupParticipants = ParticipantGroup.participants.through
                    ParticipantGroupTags = ParticipantGroup.tags.through
                    
                    # Участники
                    participant_relations = []
                    for old_group, new_group in zip(groups, created_groups):
                        for participant in old_group.participants.all():
                            if participant.id in mapping['participants']:
                                participant_relations.append(
                                    ParticipantGroupParticipants(
                                        participantgroup_id=new_group.id,
                                        participant_id=mapping['participants'][participant.id].id
                                    )
                                )
                    if participant_relations:
                        ParticipantGroupParticipants.objects.bulk_create(participant_relations)
                    
                    # Теги
                    tag_relations = []
                    for old_group, new_group in zip(groups, created_groups):
                        for tag in old_group.tags.all():
                            if tag.id in mapping['group_tags']:
                                tag_relations.append(
                                    ParticipantGroupTags(
                                        participantgroup_id=new_group.id,
                                        grouptag_id=mapping['group_tags'][tag.id].id
                                    )
                                )
                    if tag_relations:
                        ParticipantGroupTags.objects.bulk_create(tag_relations)
                else:
                    for group in groups:
                        self.stdout.write(f'   [DRY RUN] Создана бы ParticipantGroup: {group.name}')
                        mapping['participant_groups'][group.id] = group

                # 6. Копируем ParticipantGroupsV2
                self.stdout.write('6. Копирование ParticipantGroupsV2...')
                groups_v2 = list(ParticipantGroupV2.objects.filter(eventum=source_eventum))
                
                if not dry_run:
                    new_groups_v2 = [
                        ParticipantGroupV2(
                            eventum=target_eventum,
                            name=group.name,
                            is_event_group=group.is_event_group,
                        )
                        for group in groups_v2
                    ]
                    created_groups_v2 = ParticipantGroupV2.objects.bulk_create(new_groups_v2)
                    for old_group, new_group in zip(groups_v2, created_groups_v2):
                        mapping['participant_groups_v2'][old_group.id] = new_group
                else:
                    for group in groups_v2:
                        self.stdout.write(f'   [DRY RUN] Создана бы ParticipantGroupV2: {group.name}')
                        mapping['participant_groups_v2'][group.id] = group

                # 7. Копируем ParticipantGroupV2ParticipantRelation
                self.stdout.write('7. Копирование ParticipantGroupV2ParticipantRelation...')
                relations = list(ParticipantGroupV2ParticipantRelation.objects.filter(
                    group__eventum=source_eventum
                ).select_related('group', 'participant'))
                
                valid_relations = [
                    rel for rel in relations
                    if (rel.group_id in mapping['participant_groups_v2'] and
                        rel.participant_id in mapping['participants'])
                ]
                
                if not dry_run:
                    new_relations = [
                        ParticipantGroupV2ParticipantRelation(
                            group=mapping['participant_groups_v2'][rel.group_id],
                            participant=mapping['participants'][rel.participant_id],
                            relation_type=rel.relation_type,
                        )
                        for rel in valid_relations
                    ]
                    if new_relations:
                        ParticipantGroupV2ParticipantRelation.objects.bulk_create(new_relations)
                else:
                    for rel in valid_relations:
                        self.stdout.write(
                            f'   [DRY RUN] Создана бы связь: '
                            f'{rel.group.name} -> {rel.participant.name}'
                        )

                # 8. Копируем ParticipantGroupV2GroupRelation
                self.stdout.write('8. Копирование ParticipantGroupV2GroupRelation...')
                group_relations = list(ParticipantGroupV2GroupRelation.objects.filter(
                    group__eventum=source_eventum
                ).select_related('group', 'target_group'))
                
                valid_group_relations = [
                    rel for rel in group_relations
                    if (rel.group_id in mapping['participant_groups_v2'] and
                        rel.target_group_id in mapping['participant_groups_v2'])
                ]
                
                if not dry_run:
                    new_group_relations = [
                        ParticipantGroupV2GroupRelation(
                            group=mapping['participant_groups_v2'][rel.group_id],
                            target_group=mapping['participant_groups_v2'][rel.target_group_id],
                            relation_type=rel.relation_type,
                        )
                        for rel in valid_group_relations
                    ]
                    if new_group_relations:
                        ParticipantGroupV2GroupRelation.objects.bulk_create(new_group_relations)
                else:
                    for rel in valid_group_relations:
                        self.stdout.write(
                            f'   [DRY RUN] Создана бы связь групп: '
                            f'{rel.group.name} -> {rel.target_group.name}'
                        )

                # 9. Копируем EventTags
                self.stdout.write('9. Копирование EventTags...')
                event_tags = list(EventTag.objects.filter(eventum=source_eventum))
                
                if not dry_run:
                    new_event_tags = [
                        EventTag(
                            eventum=target_eventum,
                            name=tag.name,
                            slug=tag.slug,
                        )
                        for tag in event_tags
                    ]
                    created_event_tags = EventTag.objects.bulk_create(new_event_tags)
                    for old_tag, new_tag in zip(event_tags, created_event_tags):
                        mapping['event_tags'][old_tag.id] = new_tag
                else:
                    for tag in event_tags:
                        self.stdout.write(f'   [DRY RUN] Создан бы EventTag: {tag.name}')
                        mapping['event_tags'][tag.id] = tag

                # 10. Копируем Events
                self.stdout.write('10. Копирование Events...')
                events = list(Event.objects.filter(eventum=source_eventum)
                              .prefetch_related('locations', 'participants', 'groups', 'tags', 'group_tags'))
                
                if not dry_run:
                    new_events = []
                    for event in events:
                        event_group_v2 = None
                        if event.event_group_v2_id and event.event_group_v2_id in mapping['participant_groups_v2']:
                            event_group_v2 = mapping['participant_groups_v2'][event.event_group_v2_id]
                        
                        new_events.append(Event(
                            eventum=target_eventum,
                            name=event.name,
                            description=event.description,
                            start_time=event.start_time,
                            end_time=event.end_time,
                            image_url=event.image_url,
                            event_group_v2=event_group_v2,
                        ))
                    
                    created_events = Event.objects.bulk_create(new_events)
                    
                    # Сохраняем маппинг
                    for old_event, new_event in zip(events, created_events):
                        mapping['events'][old_event.id] = new_event
                    
                    # Копируем связи many-to-many через through таблицы
                    EventLocations = Event.locations.through
                    EventParticipants = Event.participants.through
                    EventGroups = Event.groups.through
                    EventTags = Event.tags.through
                    EventGroupTags = Event.group_tags.through
                    
                    # Локации
                    location_relations = []
                    for old_event, new_event in zip(events, created_events):
                        for location in old_event.locations.all():
                            if location.id in mapping['locations']:
                                location_relations.append(
                                    EventLocations(
                                        event_id=new_event.id,
                                        location_id=mapping['locations'][location.id].id
                                    )
                                )
                    if location_relations:
                        EventLocations.objects.bulk_create(location_relations)
                    
                    # Участники
                    participant_relations = []
                    for old_event, new_event in zip(events, created_events):
                        for participant in old_event.participants.all():
                            if participant.id in mapping['participants']:
                                participant_relations.append(
                                    EventParticipants(
                                        event_id=new_event.id,
                                        participant_id=mapping['participants'][participant.id].id
                                    )
                                )
                    if participant_relations:
                        EventParticipants.objects.bulk_create(participant_relations)
                    
                    # Группы
                    group_relations = []
                    for old_event, new_event in zip(events, created_events):
                        for group in old_event.groups.all():
                            if group.id in mapping['participant_groups']:
                                group_relations.append(
                                    EventGroups(
                                        event_id=new_event.id,
                                        participantgroup_id=mapping['participant_groups'][group.id].id
                                    )
                                )
                    if group_relations:
                        EventGroups.objects.bulk_create(group_relations)
                    
                    # Теги событий
                    tag_relations = []
                    for old_event, new_event in zip(events, created_events):
                        for tag in old_event.tags.all():
                            if tag.id in mapping['event_tags']:
                                tag_relations.append(
                                    EventTags(
                                        event_id=new_event.id,
                                        eventtag_id=mapping['event_tags'][tag.id].id
                                    )
                                )
                    if tag_relations:
                        EventTags.objects.bulk_create(tag_relations)
                    
                    # Теги групп
                    group_tag_relations = []
                    for old_event, new_event in zip(events, created_events):
                        for tag in old_event.group_tags.all():
                            if tag.id in mapping['group_tags']:
                                group_tag_relations.append(
                                    EventGroupTags(
                                        event_id=new_event.id,
                                        grouptag_id=mapping['group_tags'][tag.id].id
                                    )
                                )
                    if group_tag_relations:
                        EventGroupTags.objects.bulk_create(group_tag_relations)
                else:
                    for event in events:
                        self.stdout.write(f'   [DRY RUN] Создано бы Event: {event.name}')
                        mapping['events'][event.id] = event

                # 11. Копируем ParticipantGroupV2EventRelation
                self.stdout.write('11. Копирование ParticipantGroupV2EventRelation...')
                event_relations = list(ParticipantGroupV2EventRelation.objects.filter(
                    group__eventum=source_eventum
                ).select_related('group', 'event'))
                
                valid_event_relations = [
                    rel for rel in event_relations
                    if (rel.group_id in mapping['participant_groups_v2'] and
                        rel.event_id in mapping['events'])
                ]
                
                if not dry_run:
                    new_event_relations = [
                        ParticipantGroupV2EventRelation(
                            group=mapping['participant_groups_v2'][rel.group_id],
                            event=mapping['events'][rel.event_id],
                        )
                        for rel in valid_event_relations
                    ]
                    if new_event_relations:
                        ParticipantGroupV2EventRelation.objects.bulk_create(new_event_relations)
                else:
                    for rel in valid_event_relations:
                        self.stdout.write(
                            f'   [DRY RUN] Создана бы связь: '
                            f'{rel.group.name} -> {rel.event.name}'
                        )

                # 12. Копируем EventRegistrations
                self.stdout.write('12. Копирование EventRegistrations...')
                registrations = list(EventRegistration.objects.filter(event__eventum=source_eventum)
                                   .prefetch_related('applicants'))
                
                valid_registrations = [
                    reg for reg in registrations
                    if reg.event_id in mapping['events']
                ]
                
                if not dry_run:
                    new_registrations = []
                    for reg in valid_registrations:
                        allowed_group = None
                        if reg.allowed_group_id and reg.allowed_group_id in mapping['participant_groups_v2']:
                            allowed_group = mapping['participant_groups_v2'][reg.allowed_group_id]
                        
                        new_registrations.append(EventRegistration(
                            event=mapping['events'][reg.event_id],
                            max_participants=reg.max_participants,
                            allowed_group=allowed_group,
                            registration_type=reg.registration_type,
                        ))
                    
                    created_registrations = EventRegistration.objects.bulk_create(new_registrations)
                    
                    # Сохраняем маппинг
                    for old_reg, new_reg in zip(valid_registrations, created_registrations):
                        mapping['event_registrations'][old_reg.id] = new_reg
                    
                    # Копируем applicants через through таблицу
                    EventRegistrationApplicants = EventRegistration.applicants.through
                    applicant_relations = []
                    for old_reg, new_reg in zip(valid_registrations, created_registrations):
                        for applicant in old_reg.applicants.all():
                            if applicant.id in mapping['participants']:
                                applicant_relations.append(
                                    EventRegistrationApplicants(
                                        eventregistration_id=new_reg.id,
                                        participant_id=mapping['participants'][applicant.id].id
                                    )
                                )
                    if applicant_relations:
                        EventRegistrationApplicants.objects.bulk_create(applicant_relations)
                else:
                    for reg in valid_registrations:
                        self.stdout.write(
                            f'   [DRY RUN] Создана бы EventRegistration для: '
                            f'{reg.event.name}'
                        )
                        mapping['event_registrations'][reg.id] = reg

                # 13. Копируем EventRegistrationApplications
                self.stdout.write('13. Копирование EventRegistrationApplications...')
                applications = list(EventRegistrationApplication.objects.filter(
                    registration__event__eventum=source_eventum
                ).select_related('registration', 'participant', 'registration__event'))
                
                valid_applications = [
                    app for app in applications
                    if (app.registration_id in mapping['event_registrations'] and
                        app.participant_id in mapping['participants'])
                ]
                
                if not dry_run:
                    new_applications = [
                        EventRegistrationApplication(
                            registration=mapping['event_registrations'][app.registration_id],
                            participant=mapping['participants'][app.participant_id],
                            applied_at=app.applied_at,
                        )
                        for app in valid_applications
                    ]
                    if new_applications:
                        EventRegistrationApplication.objects.bulk_create(new_applications)
                else:
                    for app in valid_applications:
                        self.stdout.write(
                            f'   [DRY RUN] Создана бы заявка: '
                            f'{app.participant.name} -> {app.registration.event.name}'
                        )

                # 14. Копируем EventWaves
                self.stdout.write('14. Копирование EventWaves...')
                waves = list(EventWave.objects.filter(eventum=source_eventum)
                           .prefetch_related('registrations'))
                
                if not dry_run:
                    new_waves = [
                        EventWave(
                            eventum=target_eventum,
                            name=wave.name,
                        )
                        for wave in waves
                    ]
                    created_waves = EventWave.objects.bulk_create(new_waves)
                    
                    # Сохраняем маппинг
                    for old_wave, new_wave in zip(waves, created_waves):
                        mapping['event_waves'][old_wave.id] = new_wave
                    
                    # Копируем registrations через through таблицу
                    EventWaveRegistrations = EventWave.registrations.through
                    registration_relations = []
                    for old_wave, new_wave in zip(waves, created_waves):
                        for registration in old_wave.registrations.all():
                            if registration.id in mapping['event_registrations']:
                                registration_relations.append(
                                    EventWaveRegistrations(
                                        eventwave_id=new_wave.id,
                                        eventregistration_id=mapping['event_registrations'][registration.id].id
                                    )
                                )
                    if registration_relations:
                        EventWaveRegistrations.objects.bulk_create(registration_relations)
                else:
                    for wave in waves:
                        self.stdout.write(f'   [DRY RUN] Создана бы EventWave: {wave.name}')
                        mapping['event_waves'][wave.id] = wave

                # 15. Копируем UserRoles
                self.stdout.write('15. Копирование UserRoles...')
                roles = list(UserRole.objects.filter(eventum=source_eventum).select_related('user'))
                
                if not dry_run:
                    new_roles = [
                        UserRole(
                            user=role.user,  # Пользователи не копируются
                            eventum=target_eventum,
                            role=role.role,
                            created_at=role.created_at,
                        )
                        for role in roles
                    ]
                    if new_roles:
                        UserRole.objects.bulk_create(new_roles)
                else:
                    for role in roles:
                        self.stdout.write(
                            f'   [DRY RUN] Создана бы роль: '
                            f'{role.user.name} - {role.get_role_display()}'
                        )

                if dry_run:
                    # В dry-run режиме откатываем транзакцию
                    raise Exception("Dry run - откат транзакции")
        except Exception as e:
            if not dry_run or "Dry run" not in str(e):
                raise

