import csv
import os
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from app.models import UserProfile, Participant, Eventum


class Command(BaseCommand):
    help = 'Import participants from CSV file to eventum'

    def add_arguments(self, parser):
        parser.add_argument('csv_file', type=str, help='Path to CSV file with participants')
        parser.add_argument('eventum_slug', type=str, help='Slug of the eventum to add participants to')
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be imported without actually creating records',
        )
        parser.add_argument(
            '--skip-existing',
            action='store_true',
            help='Skip participants that already exist (by VK ID)',
        )

    def handle(self, *args, **options):
        csv_file = options['csv_file']
        eventum_slug = options['eventum_slug']
        dry_run = options['dry_run']
        skip_existing = options['skip_existing']

        # Проверяем существование файла
        if not os.path.exists(csv_file):
            raise CommandError(f'CSV file "{csv_file}" does not exist.')

        # Получаем eventum
        try:
            eventum = Eventum.objects.get(slug=eventum_slug)
        except Eventum.DoesNotExist:
            raise CommandError(f'Eventum with slug "{eventum_slug}" does not exist.')

        self.stdout.write(f'Importing participants to eventum: {eventum.name} ({eventum.slug})')
        
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No records will be created'))

        # Читаем CSV файл
        participants_data = []
        with open(csv_file, 'r', encoding='utf-8') as file:
            csv_reader = csv.reader(file)
            for row_num, row in enumerate(csv_reader, 1):
                # Пропускаем первую строку (заголовок)
                if row_num == 1:
                    self.stdout.write(f'Skipping header row: {row}')
                    continue
                
                # Пропускаем пустые строки
                if not row or len(row) < 5:
                    if row:  # Если строка не полностью пустая, но данных недостаточно
                        self.stdout.write(
                            self.style.WARNING(f'Row {row_num}: Insufficient data, skipping: {row}')
                        )
                    continue
                
                # Извлекаем данные: ФИО, ВК, Регион, Участие, vk_id
                full_name = row[0].strip()
                vk_url = row[1].strip()
                region = row[2].strip()
                participation = row[3].strip()
                vk_id_str = row[4].strip()  # vk_id в последней колонке
                
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
                
                if not full_name:
                    self.stdout.write(
                        self.style.WARNING(f'Row {row_num}: Empty name, skipping: {row}')
                    )
                    continue
                
                participants_data.append({
                    'row_num': row_num,
                    'vk_id': vk_id,
                    'full_name': full_name,
                    'vk_url': vk_url,
                    'region': region,
                    'participation': participation,
                })

        self.stdout.write(f'Found {len(participants_data)} valid participants in CSV')

        if not participants_data:
            self.stdout.write(self.style.WARNING('No valid participants found in CSV file'))
            return

        # Импортируем участников
        created_users = 0
        updated_users = 0
        created_participants = 0
        skipped_participants = 0
        errors = 0
        found_by_name = 0

        with transaction.atomic():
            for data in participants_data:
                try:
                    user = None
                    user_created = False
                    
                    if data['vk_id']:
                        # Создаем или получаем пользователя по VK ID
                        user, user_created = UserProfile.objects.get_or_create(
                            vk_id=data['vk_id'],
                            defaults={
                                'name': data['full_name'],
                                'avatar_url': '',
                                'email': '',
                            }
                        )
                    else:
                        # Ищем пользователя по имени
                        try:
                            user = UserProfile.objects.get(name=data['full_name'])
                            self.stdout.write(f'Found user by name: {user.name} (VK: {user.vk_id or "None"})')
                            found_by_name += 1
                        except UserProfile.DoesNotExist:
                            # Если пользователь не найден по имени, создаем нового без VK ID
                            user = UserProfile.objects.create(
                                vk_id=None,
                                name=data['full_name'],
                                avatar_url='',
                                email='',
                            )
                            user_created = True
                            self.stdout.write(f'Created user without VK ID: {user.name}')
                    
                    if user_created:
                        created_users += 1
                        if not dry_run:
                            vk_info = f"VK: {user.vk_id}" if user.vk_id else "No VK ID"
                            self.stdout.write(f'Created user: {user.name} ({vk_info}, Region: {data["region"]})')
                    else:
                        # Обновляем имя пользователя, если оно изменилось
                        if user.name != data['full_name']:
                            if not dry_run:
                                user.name = data['full_name']
                                user.save()
                            updated_users += 1
                            if not dry_run:
                                vk_info = f"VK: {user.vk_id}" if user.vk_id else "No VK ID"
                                self.stdout.write(f'Updated user name: {user.name} ({vk_info}, Region: {data["region"]})')
                    
                    # Проверяем, существует ли участник в данном eventum
                    participant_exists = Participant.objects.filter(
                        user=user, 
                        eventum=eventum
                    ).exists()
                    
                    if participant_exists:
                        if skip_existing:
                            skipped_participants += 1
                            if not dry_run:
                                self.stdout.write(f'Skipped existing participant: {user.name}')
                            continue
                        else:
                            # Участник уже существует, но мы не пропускаем - это ошибка
                            self.stdout.write(
                                self.style.ERROR(
                                    f'Row {data["row_num"]}: Participant {user.name} already exists in eventum'
                                )
                            )
                            errors += 1
                            continue
                    
                    # Создаем участника
                    if not dry_run:
                        participant = Participant.objects.create(
                            user=user,
                            eventum=eventum,
                            name=user.name
                        )
                        self.stdout.write(f'Created participant: {participant.name} (Region: {data["region"]}, Participation: {data["participation"]})')
                    
                    created_participants += 1
                    
                except Exception as e:
                    vk_info = f"VK: {data['vk_id']}" if data['vk_id'] else "No VK ID"
                    self.stdout.write(
                        self.style.ERROR(
                            f'Row {data["row_num"]}: Error processing {data["full_name"]} ({vk_info}): {str(e)}'
                        )
                    )
                    errors += 1

        # Выводим статистику
        self.stdout.write(self.style.SUCCESS('\n=== Import Summary ==='))
        self.stdout.write(f'Users created: {created_users}')
        self.stdout.write(f'Users updated: {updated_users}')
        self.stdout.write(f'Users found by name: {found_by_name}')
        self.stdout.write(f'Participants created: {created_participants}')
        self.stdout.write(f'Participants skipped: {skipped_participants}')
        self.stdout.write(f'Errors: {errors}')
        
        if dry_run:
            self.stdout.write(self.style.WARNING('\nDRY RUN - No actual changes were made'))
        else:
            self.stdout.write(self.style.SUCCESS(f'\nImport completed successfully!'))

