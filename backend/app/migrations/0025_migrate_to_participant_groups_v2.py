# Generated manually - Data migration

from django.db import migrations


def migrate_groups_to_v2(apps, schema_editor):
    """Миграция данных: создание групп V2 из старых групп и тегов"""
    ParticipantGroupV2 = apps.get_model('app', 'ParticipantGroupV2')
    ParticipantGroupV2ParticipantRelation = apps.get_model('app', 'ParticipantGroupV2ParticipantRelation')
    ParticipantGroupV2GroupRelation = apps.get_model('app', 'ParticipantGroupV2GroupRelation')
    ParticipantGroupV2EventRelation = apps.get_model('app', 'ParticipantGroupV2EventRelation')
    
    # Импортируем старые модели
    ParticipantGroup = apps.get_model('app', 'ParticipantGroup')
    GroupTag = apps.get_model('app', 'GroupTag')
    Event = apps.get_model('app', 'Event')
    Participant = apps.get_model('app', 'Participant')
    
    # 1. Миграция групп участников (ParticipantGroup) -> ParticipantGroupV2
    print("Migrating ParticipantGroup to ParticipantGroupV2...")
    old_groups = ParticipantGroup.objects.all().prefetch_related('participants')
    
    for old_group in old_groups:
        # Создаем новую группу V2
        new_group = ParticipantGroupV2.objects.create(
            eventum=old_group.eventum,
            name=old_group.name,
            is_event_group=False
        )
        
        # Создаем связи с участниками через bulk_create для оптимизации
        relations = [
            ParticipantGroupV2ParticipantRelation(
                group=new_group,
                participant=participant,
                relation_type='inclusive'
            )
            for participant in old_group.participants.all()
        ]
        if relations:
            ParticipantGroupV2ParticipantRelation.objects.bulk_create(relations)
        
        print(f"  Migrated group: {old_group.name} ({len(relations)} participants)")
    
    # 2. Миграция тегов групп (GroupTag) -> ParticipantGroupV2
    # Для каждого тега создаем группу V2 с участниками, которые были в группах с этим тегом
    print("\nMigrating GroupTag to ParticipantGroupV2...")
    group_tags = GroupTag.objects.all().prefetch_related('groups', 'groups__participants')
    
    for tag in group_tags:
        # Находим всех уникальных участников из всех групп с этим тегом
        participants_set = set()
        for group in tag.groups.all():
            participants_set.update(group.participants.all())
        
        if participants_set:
            # Создаем группу V2 для тега
            tag_group = ParticipantGroupV2.objects.create(
                eventum=tag.eventum,
                name=f"Tag: {tag.name}",
                is_event_group=False
            )
            
            # Создаем связи с участниками через bulk_create
            relations = [
                ParticipantGroupV2ParticipantRelation(
                    group=tag_group,
                    participant=participant,
                    relation_type='inclusive'
                )
                for participant in participants_set
            ]
            if relations:
                ParticipantGroupV2ParticipantRelation.objects.bulk_create(relations)
            
            print(f"  Migrated tag: {tag.name} ({len(relations)} participants)")
    
    # 3. Миграция событий с participant_type='manual' -> специальные группы V2
    print("\nMigrating manual events to ParticipantGroupV2...")
    manual_events = Event.objects.filter(participant_type='manual').prefetch_related(
        'participants',
        'groups',
        'groups__participants',
        'group_tags',
        'group_tags__groups',
        'group_tags__groups__participants'
    )
    
    for event in manual_events:
        # Собираем всех участников из разных источников
        all_participants = set()
        
        # Участники напрямую связанные с событием
        all_participants.update(event.participants.all())
        
        # Участники из старых групп
        for old_group in event.groups.all():
            all_participants.update(old_group.participants.all())
        
        # Участники из групп с тегами
        for tag in event.group_tags.all():
            for old_group in tag.groups.all():
                all_participants.update(old_group.participants.all())
        
        if all_participants:
            # Создаем специальную группу для события (помечаем как event_group)
            event_group = ParticipantGroupV2.objects.create(
                eventum=event.eventum,
                name=f"Event: {event.name}",
                is_event_group=True
            )
            
            # Создаем связи с участниками через bulk_create
            relations = [
                ParticipantGroupV2ParticipantRelation(
                    group=event_group,
                    participant=participant,
                    relation_type='inclusive'
                )
                for participant in all_participants
            ]
            if relations:
                ParticipantGroupV2ParticipantRelation.objects.bulk_create(relations)
            
            # Создаем связь группы с событием
            ParticipantGroupV2EventRelation.objects.create(
                group=event_group,
                event=event
            )
            
            print(f"  Migrated event: {event.name} ({len(relations)} participants)")
    
    print("\nMigration completed!")


def reverse_migration(apps, schema_editor):
    """Откат миграции: удаление всех созданных групп V2"""
    ParticipantGroupV2 = apps.get_model('app', 'ParticipantGroupV2')
    
    # Удаляем все созданные группы V2 (связанные записи удалятся автоматически через CASCADE)
    ParticipantGroupV2.objects.all().delete()
    
    print("Reversed migration: all ParticipantGroupV2 deleted")


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0024_create_participant_groups_v2'),
    ]

    operations = [
        migrations.RunPython(migrate_groups_to_v2, reverse_migration),
    ]

