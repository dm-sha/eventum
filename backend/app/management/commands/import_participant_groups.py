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
        """Find existing group by exact name match only"""
        try:
            # Ищем только по точному совпадению названия
            group = ParticipantGroup.objects.get(eventum=eventum, name=name)
            return group
        except ParticipantGroup.DoesNotExist:
            return None
        except ParticipantGroup.MultipleObjectsReturned:
            # Если найдено несколько групп с одинаковым названием, берем первую по ID
            return ParticipantGroup.objects.filter(eventum=eventum, name=name).order_by('id').first()

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
                if not row or len(row) < 5:
                    if row:
                        self.stdout.write(
                            self.style.WARNING(f'Row {row_num}: Insufficient data, skipping: {row}')
                        )
                    continue
                
                # Извлекаем данные: ФИО, ВК, Регион, Участие, vk_id
                full_name = row[0].strip()
                vk_url = row[1].strip()
                region = row[2].strip()
                groups_str = row[3].strip()
                vk_id_str = row[4].strip()
                
                # Проверяем VK ID
                vk_id = None
                if vk_id_str:
                    try:
                        vk_id = int(vk_id_str)
                    except ValueError:
                        self.stdout.write(
                            self.style.WARNING(f'Row {row_num}: Invalid VK ID "{vk_id_str}", will search by name: {full_name}')
                        )
                        vk_id = None
                
                if not full_name or not groups_str:
                    self.stdout.write(
                        self.style.WARNING(f'Row {row_num}: Empty name or groups, skipping: {row}')
                    )
                    continue
                
                # Разделяем группы по запятой и очищаем от пробелов
                group_names = [group.strip() for group in groups_str.split(',') if group.strip()]
                
                # Добавляем участника для каждой группы из колонки "Участие"
                for group_name in group_names:
                    participants_data.append({
                        'row_num': row_num,
                        'full_name': full_name,
                        'group_name': group_name,
                        'vk_url': vk_url,
                        'region': region,
                        'vk_id': vk_id,
                    })
                
                # Добавляем участника в группу по региону (если регион указан)
                if region:
                    participants_data.append({
                        'row_num': row_num,
                        'full_name': full_name,
                        'group_name': region,  # Регион как название группы
                        'vk_url': vk_url,
                        'region': region,
                        'vk_id': vk_id,
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
                            self.style.WARNING(f'Group "{group_name}" not found in {eventum.slug}')
                        )
                        continue

                    # Назначаем участников в группу
                    participants_to_add = []
                    for participant_data in group_participants:
                        participant = None
                        
                        # Сначала пытаемся найти по VK ID, если он есть
                        if participant_data['vk_id']:
                            try:
                                user = UserProfile.objects.get(vk_id=participant_data['vk_id'])
                                participant = Participant.objects.get(
                                    eventum=eventum,
                                    user=user
                                )
                                self.stdout.write(f'Found participant by VK ID: {participant.name} (VK: {participant_data["vk_id"]})')
                            except (UserProfile.DoesNotExist, Participant.DoesNotExist):
                                pass
                        
                        # Если не найден по VK ID, ищем по имени
                        if not participant:
                            try:
                                participant = Participant.objects.get(
                                    eventum=eventum,
                                    name=participant_data['full_name']
                                )
                                vk_info = f"VK: {participant_data['vk_id']}" if participant_data['vk_id'] else "No VK ID"
                                self.stdout.write(f'Found participant by name: {participant.name} ({vk_info})')
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
                        
                        if participant:
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
