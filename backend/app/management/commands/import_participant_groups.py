import csv
import os
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from app.models import UserProfile, Participant, Eventum, ParticipantGroup
from django.utils.text import slugify
from transliterate import translit


class Command(BaseCommand):
    help = 'Import participant groups from CSV file and assign participants to groups'

    def add_arguments(self, parser):
        parser.add_argument('csv_file', type=str, help='Path to CSV file with participant groups')
        parser.add_argument('eventum_slug', type=str, help='Slug of the eventum to create groups in')
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be imported without actually creating records',
        )
        parser.add_argument(
            '--clear-existing',
            action='store_true',
            help='Clear existing group assignments before importing',
        )

    def find_group_by_name(self, name, eventum):
        """Find existing group by name"""
        try:
            # Ищем все группы с таким названием и выбираем первую (с наименьшим ID)
            groups = ParticipantGroup.objects.filter(eventum=eventum, name=name).order_by('id')
            if groups.exists():
                return groups.first()
        except ParticipantGroup.DoesNotExist:
            pass
        
        # Если точного совпадения нет, пробуем найти по частичному совпадению
        groups = ParticipantGroup.objects.filter(eventum=eventum, name__icontains=name).order_by('id')
        if groups.count() == 1:
            return groups.first()
        elif groups.count() > 1:
            # Если найдено несколько, пробуем найти наиболее точное совпадение
            exact_matches = [g for g in groups if g.name.lower() == name.lower()]
            if len(exact_matches) == 1:
                return exact_matches[0]
            elif len(exact_matches) > 1:
                # Если есть несколько точных совпадений, берем первое по ID
                return sorted(exact_matches, key=lambda x: x.id)[0]
        
        return None

    def handle(self, *args, **options):
        csv_file = options['csv_file']
        eventum_slug = options['eventum_slug']
        dry_run = options['dry_run']
        clear_existing = options['clear_existing']

        # Проверяем существование файла
        if not os.path.exists(csv_file):
            raise CommandError(f'CSV file "{csv_file}" does not exist.')

        # Получаем eventum
        try:
            eventum = Eventum.objects.get(slug=eventum_slug)
        except Eventum.DoesNotExist:
            raise CommandError(f'Eventum with slug "{eventum_slug}" does not exist.')

        self.stdout.write(f'Importing participant groups to eventum: {eventum.name} ({eventum.slug})')
        
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No records will be created'))

        # Читаем CSV файл
        participants_data = []
        with open(csv_file, 'r', encoding='utf-8') as file:
            csv_reader = csv.reader(file)
            next(csv_reader)  # Пропускаем заголовок
            
            for row_num, row in enumerate(csv_reader, 2):  # Начинаем с 2, т.к. пропустили заголовок
                # Пропускаем пустые строки
                if not row or len(row) < 4:
                    if row:
                        self.stdout.write(
                            self.style.WARNING(f'Row {row_num}: Insufficient data, skipping: {row}')
                        )
                    continue
                
                # Извлекаем данные: ФИО, ВК, Регион, Участие
                full_name = row[0].strip()
                vk_url = row[1].strip()
                region = row[2].strip()
                group_name = row[3].strip()
                
                if not full_name or not group_name:
                    self.stdout.write(
                        self.style.WARNING(f'Row {row_num}: Empty name or group, skipping: {row}')
                    )
                    continue
                
                participants_data.append({
                    'row_num': row_num,
                    'full_name': full_name,
                    'group_name': group_name,
                    'vk_url': vk_url,
                    'region': region,
                })

        self.stdout.write(f'Found {len(participants_data)} valid participant-group assignments in CSV')

        if not participants_data:
            self.stdout.write(self.style.WARNING('No valid participant-group assignments found in CSV file'))
            return

        # Собираем уникальные группы
        unique_groups = {}
        for data in participants_data:
            group_name = data['group_name']
            if group_name not in unique_groups:
                unique_groups[group_name] = []
            unique_groups[group_name].append(data)

        self.stdout.write(f'Found {len(unique_groups)} unique groups')

        # Статистика
        groups_found = 0
        groups_not_found = 0
        participants_assigned = 0
        participants_not_found = 0
        errors = 0

        with transaction.atomic():
            # Очищаем существующие назначения, если требуется
            if clear_existing and not dry_run:
                for group in ParticipantGroup.objects.filter(eventum=eventum):
                    group.participants.clear()
                self.stdout.write('Cleared existing group assignments')

            # Ищем существующие группы и назначаем участников
            for group_name, group_participants in unique_groups.items():
                try:
                    # Ищем существующую группу по названию
                    group = self.find_group_by_name(group_name, eventum)
                    
                    if group:
                        groups_found += 1
                        if not dry_run:
                            self.stdout.write(f'Found group: {group.name}')
                    else:
                        groups_not_found += 1
                        self.stdout.write(
                            self.style.WARNING(f'Group "{group_name}" not found in eventum')
                        )
                        continue

                    # Назначаем участников в группу
                    participants_to_add = []
                    for participant_data in group_participants:
                        try:
                            # Ищем участника по имени в данном eventum
                            participant = Participant.objects.get(
                                eventum=eventum,
                                name=participant_data['full_name']
                            )
                            participants_to_add.append(participant)
                            
                        except Participant.DoesNotExist:
                            self.stdout.write(
                                self.style.WARNING(
                                    f'Row {participant_data["row_num"]}: Participant "{participant_data["full_name"]}" not found in eventum'
                                )
                            )
                            participants_not_found += 1
                            continue
                        except Participant.MultipleObjectsReturned:
                            # Если найдено несколько участников с одинаковым именем
                            self.stdout.write(
                                self.style.WARNING(
                                    f'Row {participant_data["row_num"]}: Multiple participants found with name "{participant_data["full_name"]}", using first one'
                                )
                            )
                            participant = Participant.objects.filter(
                                eventum=eventum,
                                name=participant_data['full_name']
                            ).first()
                            participants_to_add.append(participant)

                    # Добавляем участников в группу
                    if participants_to_add and not dry_run:
                        if clear_existing:
                            # Если очищаем существующие, заменяем полностью
                            group.participants.set(participants_to_add)
                        else:
                            # Иначе добавляем к существующим
                            for participant in participants_to_add:
                                group.participants.add(participant)
                        
                        participants_assigned += len(participants_to_add)
                        self.stdout.write(f'Assigned {len(participants_to_add)} participants to group "{group.name}"')
                    elif participants_to_add:
                        participants_assigned += len(participants_to_add)

                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f'Error processing group "{group_name}": {str(e)}')
                    )
                    errors += 1

        # Выводим статистику
        self.stdout.write(self.style.SUCCESS('\n=== Import Summary ==='))
        self.stdout.write(f'Groups found: {groups_found}')
        self.stdout.write(f'Groups not found: {groups_not_found}')
        self.stdout.write(f'Participants assigned: {participants_assigned}')
        self.stdout.write(f'Participants not found: {participants_not_found}')
        self.stdout.write(f'Errors: {errors}')
        
        if dry_run:
            self.stdout.write(self.style.WARNING('\nDRY RUN - No actual changes were made'))
        else:
            self.stdout.write(self.style.SUCCESS(f'\nGroup import completed successfully!'))
