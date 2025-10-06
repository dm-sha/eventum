#!/usr/bin/env python
"""
Скрипт для дублирования eventum'а со всеми связанными данными
"""
import os
import sys
import django
from django.db import transaction
from django.utils import timezone

# Настройка Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'eventum.settings')
django.setup()

from app.models import (
    Eventum, Participant, GroupTag, ParticipantGroup, EventTag, Event, 
    Location, EventWave, EventRegistration, UserRole
)

def duplicate_eventum(source_slug, new_name, new_slug=None):
    """
    Дублирует eventum со всеми связанными данными
    
    Args:
        source_slug (str): slug исходного eventum'а
        new_name (str): название нового eventum'а
        new_slug (str): slug нового eventum'а (если не указан, генерируется автоматически)
    
    Returns:
        Eventum: новый eventum
    """
    
    try:
        # Находим исходный eventum
        source_eventum = Eventum.objects.get(slug=source_slug)
        print(f"Найден исходный eventum: {source_eventum.name} (slug: {source_eventum.slug})")
        
        # Создаем новый eventum
        new_eventum = Eventum(
            name=new_name,
            slug=new_slug,
            description=source_eventum.description,
            image_url=source_eventum.image_url,
            registration_open=source_eventum.registration_open
        )
        new_eventum.save()
        print(f"Создан новый eventum: {new_eventum.name} (slug: {new_eventum.slug})")
        
        with transaction.atomic():
            # 1. Копируем локации
            print("Копируем локации...")
            location_mapping = {}
            for location in source_eventum.locations.all():
                new_location = Location(
                    eventum=new_eventum,
                    name=location.name,
                    slug=location.slug,
                    kind=location.kind,
                    address=location.address,
                    floor=location.floor,
                    notes=location.notes
                )
                new_location.save()
                location_mapping[location.id] = new_location
                print(f"  Скопирована локация: {new_location.name}")
            
            # Обновляем связи parent для локаций
            for location in source_eventum.locations.all():
                if location.parent:
                    new_location = location_mapping[location.id]
                    new_location.parent = location_mapping[location.parent.id]
                    new_location.save()
            
            # 2. Копируем теги групп
            print("Копируем теги групп...")
            group_tag_mapping = {}
            for group_tag in source_eventum.group_tags.all():
                new_group_tag = GroupTag(
                    eventum=new_eventum,
                    name=group_tag.name,
                    slug=group_tag.slug
                )
                new_group_tag.save()
                group_tag_mapping[group_tag.id] = new_group_tag
                print(f"  Скопирован тег группы: {new_group_tag.name}")
            
            # 3. Копируем теги событий
            print("Копируем теги событий...")
            event_tag_mapping = {}
            for event_tag in source_eventum.event_tags.all():
                new_event_tag = EventTag(
                    eventum=new_eventum,
                    name=event_tag.name,
                    slug=event_tag.slug
                )
                new_event_tag.save()
                event_tag_mapping[event_tag.id] = new_event_tag
                print(f"  Скопирован тег события: {new_event_tag.name}")
            
            # 4. Копируем участников
            print("Копируем участников...")
            participant_mapping = {}
            for participant in source_eventum.participants.all():
                new_participant = Participant(
                    eventum=new_eventum,
                    user=participant.user,  # Ссылка на пользователя остается той же
                    name=participant.name
                )
                new_participant.save()
                participant_mapping[participant.id] = new_participant
                print(f"  Скопирован участник: {new_participant.name}")
            
            # 5. Копируем группы участников
            print("Копируем группы участников...")
            participant_group_mapping = {}
            for group in source_eventum.participant_groups.all():
                new_group = ParticipantGroup(
                    eventum=new_eventum,
                    name=group.name,
                    slug=group.slug
                )
                new_group.save()
                
                # Копируем связи с участниками
                for participant in group.participants.all():
                    if participant.id in participant_mapping:
                        new_group.participants.add(participant_mapping[participant.id])
                
                # Копируем связи с тегами групп
                for tag in group.tags.all():
                    if tag.id in group_tag_mapping:
                        new_group.tags.add(group_tag_mapping[tag.id])
                
                participant_group_mapping[group.id] = new_group
                print(f"  Скопирована группа: {new_group.name}")
            
            # 6. Копируем события
            print("Копируем события...")
            event_mapping = {}
            for event in source_eventum.events.all():
                new_event = Event(
                    eventum=new_eventum,
                    name=event.name,
                    description=event.description,
                    start_time=event.start_time,
                    end_time=event.end_time,
                    participant_type=event.participant_type,
                    max_participants=event.max_participants,
                    image_url=event.image_url
                )
                new_event.save()
                
                # Копируем связи с локациями
                for location in event.locations.all():
                    if location.id in location_mapping:
                        new_event.locations.add(location_mapping[location.id])
                
                # Копируем связи с участниками
                for participant in event.participants.all():
                    if participant.id in participant_mapping:
                        new_event.participants.add(participant_mapping[participant.id])
                
                # Копируем связи с группами
                for group in event.groups.all():
                    if group.id in participant_group_mapping:
                        new_event.groups.add(participant_group_mapping[group.id])
                
                # Копируем связи с тегами событий
                for tag in event.tags.all():
                    if tag.id in event_tag_mapping:
                        new_event.tags.add(event_tag_mapping[tag.id])
                
                # Копируем связи с тегами групп
                for group_tag in event.group_tags.all():
                    if group_tag.id in group_tag_mapping:
                        new_event.group_tags.add(group_tag_mapping[group_tag.id])
                
                event_mapping[event.id] = new_event
                print(f"  Скопировано событие: {new_event.name}")
            
            # 7. Копируем волны событий
            print("Копируем волны событий...")
            for wave in source_eventum.event_waves.all():
                new_wave = EventWave(
                    eventum=new_eventum,
                    name=wave.name,
                    tag=event_tag_mapping[wave.tag.id]
                )
                new_wave.save()
                
                # Копируем whitelist_groups
                for group in wave.whitelist_groups.all():
                    if group.id in participant_group_mapping:
                        new_wave.whitelist_groups.add(participant_group_mapping[group.id])
                
                # Копируем whitelist_group_tags
                for tag in wave.whitelist_group_tags.all():
                    if tag.id in group_tag_mapping:
                        new_wave.whitelist_group_tags.add(group_tag_mapping[tag.id])
                
                # Копируем blacklist_groups
                for group in wave.blacklist_groups.all():
                    if group.id in participant_group_mapping:
                        new_wave.blacklist_groups.add(participant_group_mapping[group.id])
                
                # Копируем blacklist_group_tags
                for tag in wave.blacklist_group_tags.all():
                    if tag.id in group_tag_mapping:
                        new_wave.blacklist_group_tags.add(group_tag_mapping[tag.id])
                
                print(f"  Скопирована волна: {new_wave.name}")
            
            # 8. Копируем регистрации на события
            print("Копируем регистрации на события...")
            for registration in EventRegistration.objects.filter(event__eventum=source_eventum):
                if (registration.participant.id in participant_mapping and 
                    registration.event.id in event_mapping):
                    new_registration = EventRegistration(
                        participant=participant_mapping[registration.participant.id],
                        event=event_mapping[registration.event.id],
                        registered_at=registration.registered_at
                    )
                    new_registration.save()
                    print(f"  Скопирована регистрация: {new_registration}")
            
            # 9. Копируем роли пользователей
            print("Копируем роли пользователей...")
            for role in source_eventum.user_roles.all():
                new_role = UserRole(
                    user=role.user,
                    eventum=new_eventum,
                    role=role.role,
                    created_at=role.created_at
                )
                new_role.save()
                print(f"  Скопирована роль: {new_role}")
        
        print(f"\n✅ Дублирование завершено успешно!")
        print(f"Новый eventum: {new_eventum.name} (slug: {new_eventum.slug})")
        
        # Статистика
        print(f"\n📊 Статистика скопированных данных:")
        print(f"  Локации: {new_eventum.locations.count()}")
        print(f"  Теги групп: {new_eventum.group_tags.count()}")
        print(f"  Теги событий: {new_eventum.event_tags.count()}")
        print(f"  Участники: {new_eventum.participants.count()}")
        print(f"  Группы участников: {new_eventum.participant_groups.count()}")
        print(f"  События: {new_eventum.events.count()}")
        print(f"  Волны событий: {new_eventum.event_waves.count()}")
        print(f"  Регистрации: {EventRegistration.objects.filter(event__eventum=new_eventum).count()}")
        print(f"  Роли пользователей: {new_eventum.user_roles.count()}")
        
        return new_eventum
        
    except Eventum.DoesNotExist:
        print(f"❌ Ошибка: Eventum с slug '{source_slug}' не найден")
        return None
    except Exception as e:
        print(f"❌ Ошибка при дублировании: {e}")
        return None

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Использование: python duplicate_eventum.py <source_slug> <new_name> [new_slug]")
        print("Пример: python duplicate_eventum.py szfo2025 'SZFO 2026' szfo2026")
        sys.exit(1)
    
    source_slug = sys.argv[1]
    new_name = sys.argv[2]
    new_slug = sys.argv[3] if len(sys.argv) > 3 else None
    
    duplicate_eventum(source_slug, new_name, new_slug)
