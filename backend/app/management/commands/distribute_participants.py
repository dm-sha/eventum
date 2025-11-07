import random
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from app.models import (
    EventWave, EventRegistration,
    Event, ParticipantGroupV2, ParticipantGroupV2ParticipantRelation,
    ParticipantGroupV2GroupRelation
)


class Command(BaseCommand):
    help = 'Распределяет участников по мероприятиям в волнах (только для регистраций типа APPLICATION)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--eventum-slug',
            type=str,
            help='Slug eventum\'а для обработки (если не указан, обрабатываются все eventum\'ы)'
        )
        parser.add_argument(
            '--wave-id',
            type=int,
            help='ID конкретной волны для обработки (если не указан, обрабатываются все волны)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Показать что будет сделано без фактического распределения'
        )

    def handle(self, *args, **options):
        eventum_slug = options.get('eventum_slug')
        wave_id = options.get('wave_id')
        dry_run = options.get('dry_run', False)

        # Получаем волны для обработки
        waves_query = EventWave.objects.select_related('eventum').prefetch_related(
            'registrations__event',
            'registrations__event__eventum',
            'registrations__event__event_group_v2'
        )
        
        if eventum_slug:
            waves_query = waves_query.filter(eventum__slug=eventum_slug)
        
        if wave_id:
            waves_query = waves_query.filter(id=wave_id)
        
        waves = list(waves_query.all())
        
        if not waves:
            self.stdout.write(self.style.WARNING('Не найдено волн для обработки'))
            return

        self.stdout.write(f'Найдено волн: {len(waves)}')

        if dry_run:
            self.stdout.write(self.style.WARNING('РЕЖИМ ПРОВЕРКИ (dry-run) - изменения не будут сохранены'))

        # В режиме dry-run не используем транзакцию, чтобы не делать изменения
        if dry_run:
            for wave in waves:
                self.stdout.write(f'\nОбработка волны: {wave.name} (eventum: {wave.eventum.name})')
                self._process_wave(wave, dry_run)
        else:
            with transaction.atomic():
                for wave in waves:
                    self.stdout.write(f'\nОбработка волны: {wave.name} (eventum: {wave.eventum.name})')
                    self._process_wave(wave, dry_run)

        self.stdout.write(self.style.SUCCESS('\nРаспределение завершено!'))

    def _process_wave(self, wave, dry_run):
        """Обрабатывает одну волну: распределяет участников по мероприятиям"""
        # Получаем все регистрации типа APPLICATION в этой волне
        registrations = wave.registrations.filter(
            registration_type=EventRegistration.RegistrationType.APPLICATION
        ).select_related('event', 'event__eventum').prefetch_related(
            'applicants'
        )

        if not registrations.exists():
            self.stdout.write(self.style.WARNING(f'  В волне "{wave.name}" нет регистраций типа APPLICATION'))
            return

        # Множество участников, которые уже попали на какое-то мероприятие в этой волне
        assigned_participants = set()

        # Список регистраций для обработки (будем обрабатывать по одной, выбирая с минимальным количеством заявок)
        registrations_list = list(registrations)
        
        # Сохраняем общее количество заявок для каждого мероприятия до начала распределения
        total_applications_by_registration = {
            reg.id: reg.applicants.count() for reg in registrations_list
        }
        
        self.stdout.write(f'  Найдено регистраций в волне: {len(registrations_list)}')
        
        # Счетчик порядка распределения
        distribution_order = 0
        
        # Обрабатываем регистрации пока они есть
        while registrations_list:
            # Находим регистрацию с минимальным количеством актуальных заявок
            best_registration = None
            min_applications_count = float('inf')
            best_applications = []

            for registration in registrations_list:
                # Получаем актуальные заявки (исключая участников, которые уже попали на другие мероприятия)
                # Используем поле applicants (ManyToMany) для доступа к заявкам
                available_participants = registration.applicants.exclude(
                    id__in=assigned_participants
                )

                applications_count = available_participants.count()
                
                if applications_count < min_applications_count:
                    min_applications_count = applications_count
                    best_registration = registration
                    best_applications = list(available_participants)

            if not best_registration:
                break

            # Увеличиваем счетчик порядка распределения
            distribution_order += 1

            # Обрабатываем найденную регистрацию
            self._process_registration(
                best_registration,
                best_applications,
                assigned_participants,
                distribution_order,
                total_applications_by_registration[best_registration.id],
                dry_run
            )

            # Удаляем обработанную регистрацию из списка
            registrations_list.remove(best_registration)

    def _process_registration(self, registration, available_participants_list, assigned_participants, 
                             distribution_order, total_applications, dry_run):
        """Обрабатывает одну регистрацию: выбирает участников и добавляет их в группу мероприятия"""
        event = registration.event
        max_participants = registration.max_participants

        # available_participants_list уже содержит участников (не объекты заявок)
        available_participants = available_participants_list
        actual_applications_count = len(available_participants)

        if not available_participants:
            self.stdout.write(
                self.style.WARNING(
                    f'  [{distribution_order}] Мероприятие "{event.name}": '
                    f'всего заявок {total_applications}, '
                    f'актуальных после распределения предыдущих {actual_applications_count}, '
                    f'записано участников 0'
                )
            )
            return

        # Определяем, сколько участников выбрать
        if max_participants is None:
            # Если max_participants не указан, берем всех доступных
            selected_participants = available_participants
        elif len(available_participants) <= max_participants:
            # Если заявок меньше или равно максимальному количеству, берем всех
            selected_participants = available_participants
        else:
            # Если заявок больше, выбираем рандомных
            selected_participants = random.sample(available_participants, max_participants)

        selected_count = len(selected_participants)

        # Получаем или создаем группу для мероприятия
        event_group = self._get_or_create_event_group(event, dry_run)

        if dry_run:
            # В режиме dry-run просто показываем, что будет сделано
            self.stdout.write(f'    [DRY-RUN] Будет удалено всех существующих связей (с участниками и группами) и добавлено {selected_count} участников')
        else:
            # Удаляем все существующие связи группы: и с участниками, и с группами, всех типов
            ParticipantGroupV2ParticipantRelation.objects.filter(
                group=event_group
            ).delete()
            ParticipantGroupV2GroupRelation.objects.filter(
                group=event_group
            ).delete()

            # Добавляем выбранных участников в группу
            relations_to_create = [
                ParticipantGroupV2ParticipantRelation(
                    group=event_group,
                    participant=participant,
                    relation_type=ParticipantGroupV2ParticipantRelation.RelationType.INCLUSIVE
                )
                for participant in selected_participants
            ]
            ParticipantGroupV2ParticipantRelation.objects.bulk_create(relations_to_create)

        # Добавляем выбранных участников в множество уже распределенных
        for participant in selected_participants:
            assigned_participants.add(participant.id)

        # Выводим итоговую информацию о распределении
        self.stdout.write(
            self.style.SUCCESS(
                f'  [{distribution_order}] Мероприятие "{event.name}": '
                f'всего заявок {total_applications}, '
                f'актуальных после распределения предыдущих {actual_applications_count}, '
                f'записано участников {selected_count}'
            )
        )

    def _get_or_create_event_group(self, event, dry_run):
        """Получает или создает группу V2 для мероприятия"""
        # Проверяем, есть ли уже связанная группа
        if event.event_group_v2:
            event_group = event.event_group_v2
            self.stdout.write(f'    Используется существующая группа: "{event_group.name}"')
            return event_group

        # Создаем новую группу
        group_name = f'Участники "{event.name}"'
        
        if dry_run:
            self.stdout.write(f'    [DRY-RUN] Будет создана группа: "{group_name}"')
            # В режиме dry-run создаем временный объект для демонстрации
            class TempGroup:
                def __init__(self, name):
                    self.name = name
                    self.id = None
            return TempGroup(group_name)

        # Создаем группу
        event_group = ParticipantGroupV2.objects.create(
            eventum=event.eventum,
            name=group_name,
            is_event_group=True
        )

        # Связываем группу с мероприятием
        event.event_group_v2 = event_group
        event.save(update_fields=['event_group_v2'])

        self.stdout.write(f'    Создана новая группа: "{event_group.name}"')
        return event_group

