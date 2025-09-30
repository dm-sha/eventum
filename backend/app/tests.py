from datetime import timedelta

from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from .models import (
    Event,
    EventTag,
    Eventum,
    GroupTag,
    Location,
    Participant,
    ParticipantGroup,
    UserProfile,
    UserRole,
)


class SlugGenerationTests(TestCase):
    def setUp(self):
        self.eventum = Eventum.objects.create(name="Primary Eventum")
        self.other_eventum = Eventum.objects.create(name="Secondary Eventum")

    def test_eventum_slug_unique_for_duplicate_names(self):
        first = Eventum.objects.create(name="Duplicate Name Eventum")
        second = Eventum.objects.create(name="Duplicate Name Eventum")

        self.assertEqual(first.slug, "duplicate-name-eventum")
        self.assertEqual(second.slug, "duplicate-name-eventum-1")

    def test_group_tag_slug_scoped_by_eventum(self):
        first = GroupTag.objects.create(eventum=self.eventum, name="Tag Name")
        second = GroupTag.objects.create(eventum=self.eventum, name="Tag Name")
        other = GroupTag.objects.create(eventum=self.other_eventum, name="Tag Name")

        self.assertEqual(first.slug, "tag-name")
        self.assertEqual(second.slug, "tag-name-1")
        self.assertEqual(other.slug, "tag-name")

    def test_participant_group_slug_scoped_by_eventum(self):
        first = ParticipantGroup.objects.create(eventum=self.eventum, name="Group Name")
        second = ParticipantGroup.objects.create(eventum=self.eventum, name="Group Name")
        other = ParticipantGroup.objects.create(eventum=self.other_eventum, name="Group Name")

        self.assertEqual(first.slug, "group-name")
        self.assertEqual(second.slug, "group-name-1")
        self.assertEqual(other.slug, "group-name")

    def test_event_tag_slug_scoped_by_eventum(self):
        first = EventTag.objects.create(eventum=self.eventum, name="Agenda")
        second = EventTag.objects.create(eventum=self.eventum, name="Agenda")
        other = EventTag.objects.create(eventum=self.other_eventum, name="Agenda")

        self.assertEqual(first.slug, "agenda")
        self.assertEqual(second.slug, "agenda-1")
        self.assertEqual(other.slug, "agenda")

    def test_location_slug_uniqueness_and_manual_conflicts(self):
        first = Location.objects.create(eventum=self.eventum, name="Main Hall")
        duplicate = Location.objects.create(eventum=self.eventum, name="Main Hall")
        cross = Location.objects.create(eventum=self.other_eventum, name="Main Hall")

        manual = Location.objects.create(eventum=self.eventum, name="Custom", slug="custom")
        manual_duplicate = Location.objects.create(eventum=self.eventum, name="Another", slug="custom")

        self.assertEqual(first.slug, "main-hall")
        self.assertEqual(duplicate.slug, "main-hall-1")
        self.assertEqual(cross.slug, "main-hall")
        self.assertEqual(manual.slug, "custom")
        self.assertEqual(manual_duplicate.slug, "custom-1")


class ParticipantModelTests(TestCase):
    def setUp(self):
        self.eventum = Eventum.objects.create(name="Participants Eventum")
        self.user = UserProfile.objects.create_user(vk_id=1001, name="Registered User")

    def test_name_is_synced_with_user_profile(self):
        participant = Participant.objects.create(
            eventum=self.eventum,
            user=self.user,
            name="Another Name",
        )

        self.assertEqual(participant.name, self.user.name)

    def test_same_user_cannot_join_eventum_twice(self):
        Participant.objects.create(eventum=self.eventum, user=self.user, name=self.user.name)

        with self.assertRaises(ValidationError):
            Participant.objects.create(eventum=self.eventum, user=self.user, name=self.user.name)


class EventModelValidationTests(TestCase):
    def setUp(self):
        self.eventum = Eventum.objects.create(name="Main Eventum")
        self.other_eventum = Eventum.objects.create(name="External Eventum")

        self.participant = Participant.objects.create(eventum=self.eventum, name="Local Participant")
        self.foreign_participant = Participant.objects.create(
            eventum=self.other_eventum,
            name="Foreign Participant",
        )

        self.group = ParticipantGroup.objects.create(eventum=self.eventum, name="Local Group")
        self.group.participants.add(self.participant)

        self.foreign_group = ParticipantGroup.objects.create(eventum=self.other_eventum, name="Foreign Group")
        self.foreign_group.participants.add(self.foreign_participant)

    def test_end_time_must_be_after_start_time(self):
        now = timezone.now()
        event = Event(
            eventum=self.eventum,
            name="Invalid Schedule",
            start_time=now,
            end_time=now - timedelta(hours=1),
        )

        with self.assertRaises(ValidationError):
            event.full_clean()

    def test_cannot_attach_foreign_participants(self):
        now = timezone.now()
        event = Event.objects.create(
            eventum=self.eventum,
            name="Participants Check",
            start_time=now,
            end_time=now + timedelta(hours=1),
        )
        event.participants.add(self.participant, self.foreign_participant)

        with self.assertRaises(ValidationError):
            event.full_clean()

    def test_cannot_attach_foreign_groups(self):
        now = timezone.now()
        event = Event.objects.create(
            eventum=self.eventum,
            name="Groups Check",
            start_time=now,
            end_time=now + timedelta(hours=1),
        )
        event.groups.add(self.group, self.foreign_group)

        with self.assertRaises(ValidationError):
            event.full_clean()


class LocationModelValidationTests(TestCase):
    def setUp(self):
        self.eventum = Eventum.objects.create(name="Location Eventum")
        self.other_eventum = Eventum.objects.create(name="Other Location Eventum")
        self.root = Location.objects.create(
            eventum=self.eventum,
            name="Venue",
            kind=Location.Kind.VENUE,
        )

    def test_parent_must_belong_to_same_eventum(self):
        invalid_child = Location(
            eventum=self.other_eventum,
            name="Invalid Child",
            kind=Location.Kind.BUILDING,
            parent=self.root,
        )

        with self.assertRaises(ValidationError):
            invalid_child.full_clean()

    def test_invalid_hierarchy_is_rejected(self):
        invalid_child = Location(
            eventum=self.eventum,
            name="Room Under Venue",
            kind=Location.Kind.ROOM,
            parent=self.root,
        )

        with self.assertRaises(ValidationError):
            invalid_child.full_clean()

    def test_cycle_detection_prevents_loops(self):
        building = Location.objects.create(
            eventum=self.eventum,
            name="Building",
            kind=Location.Kind.BUILDING,
            parent=self.root,
        )
        room = Location.objects.create(
            eventum=self.eventum,
            name="Room",
            kind=Location.Kind.ROOM,
            parent=building,
        )

        self.root.parent = room
        with self.assertRaises(ValidationError):
            self.root.full_clean()

    def test_slug_conflict_is_resolved_on_save(self):
        Location.objects.create(eventum=self.eventum, name="Hall", slug="shared")
        duplicate = Location.objects.create(eventum=self.eventum, name="Other Hall", slug="shared")

        self.assertEqual(duplicate.slug, "shared-1")


class APISlugAndValidationTests(APITestCase):
    def setUp(self):
        self.user = UserProfile.objects.create_user(
            vk_id=5001,
            name="Organizer",
            email="organizer@example.com",
        )
        self.eventum = Eventum.objects.create(name="API Managed Eventum")
        UserRole.objects.create(user=self.user, eventum=self.eventum, role='organizer')

        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}")

    def test_eventum_creation_assigns_role_and_generates_unique_slug(self):
        url = reverse('eventum-list')
        payload = {'name': 'Brand New Eventum'}

        response1 = self.client.post(url, payload, format='json')
        self.assertEqual(response1.status_code, status.HTTP_201_CREATED)
        slug1 = response1.data['slug']
        created_eventum1 = Eventum.objects.get(slug=slug1)
        self.assertTrue(
            UserRole.objects.filter(user=self.user, eventum=created_eventum1, role='organizer').exists()
        )

        response2 = self.client.post(url, payload, format='json')
        self.assertEqual(response2.status_code, status.HTTP_201_CREATED)
        slug2 = response2.data['slug']
        self.assertTrue(slug2.startswith(slug1))
        self.assertNotEqual(slug1, slug2)

    def test_group_tag_slug_generation_via_api(self):
        url = reverse('grouptag-list', kwargs={'eventum_slug': self.eventum.slug})

        response1 = self.client.post(url, {'name': 'Tag Sample'}, format='json')
        self.assertEqual(response1.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response1.data['slug'], 'tag-sample')

        response2 = self.client.post(url, {'name': 'Tag Sample'}, format='json')
        self.assertEqual(response2.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response2.data['slug'], 'tag-sample-1')

    def test_participant_group_rejects_foreign_participant(self):
        local_participant = Participant.objects.create(eventum=self.eventum, name="Local")
        other_eventum = Eventum.objects.create(name="Foreign Eventum")
        foreign_participant = Participant.objects.create(eventum=other_eventum, name="Foreign")

        url = reverse('participantgroup-list', kwargs={'eventum_slug': self.eventum.slug})
        payload = {
            'name': 'Invalid Group',
            'participants': [local_participant.id, foreign_participant.id],
        }

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('другому мероприятию', str(response.data))

    def test_event_creation_rejects_foreign_participant(self):
        local_participant = Participant.objects.create(eventum=self.eventum, name="Local")
        other_eventum = Eventum.objects.create(name="Other Eventum")
        foreign_participant = Participant.objects.create(eventum=other_eventum, name="Foreign")

        url = reverse('event-list', kwargs={'eventum_slug': self.eventum.slug})
        now = timezone.now()
        payload = {
            'name': 'Participant Validation',
            'start_time': (now + timedelta(hours=1)).isoformat(),
            'end_time': (now + timedelta(hours=2)).isoformat(),
            'participants': [local_participant.id, foreign_participant.id],
        }

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('другому мероприятию', str(response.data))

    def test_event_creation_rejects_foreign_group(self):
        local_group = ParticipantGroup.objects.create(eventum=self.eventum, name="Local Group")
        other_eventum = Eventum.objects.create(name="Other Eventum")
        foreign_group = ParticipantGroup.objects.create(eventum=other_eventum, name="Foreign Group")

        url = reverse('event-list', kwargs={'eventum_slug': self.eventum.slug})
        now = timezone.now()
        payload = {
            'name': 'Group Validation',
            'start_time': (now + timedelta(hours=1)).isoformat(),
            'end_time': (now + timedelta(hours=2)).isoformat(),
            'groups': [local_group.id, foreign_group.id],
        }

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('другому мероприятию', str(response.data))

    def test_location_creation_generates_unique_slug(self):
        url = reverse('location-list', kwargs={'eventum_slug': self.eventum.slug})
        payload = {'name': 'Location Name', 'kind': Location.Kind.VENUE}

        response1 = self.client.post(url, payload, format='json')
        self.assertEqual(response1.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response1.data['slug'], 'location-name')

        response2 = self.client.post(url, payload, format='json')
        self.assertEqual(response2.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response2.data['slug'], 'location-name-1')


class PerformanceQueryTests(APITestCase):
    def setUp(self):
        self.user = UserProfile.objects.create_user(vk_id=9001, name="Perf User")
        self.eventum = Eventum.objects.create(name="Performance Eventum")
        UserRole.objects.create(user=self.user, eventum=self.eventum, role='organizer')

        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}")

    def test_upcoming_events_use_prefetches(self):
        participants = [
            Participant.objects.create(eventum=self.eventum, name=f"Participant {idx}")
            for idx in range(5)
        ]
        group = ParticipantGroup.objects.create(eventum=self.eventum, name="Group")
        group.participants.add(*participants)
        tag = EventTag.objects.create(eventum=self.eventum, name="General")

        now = timezone.now()
        for idx in range(5):
            event = Event.objects.create(
                eventum=self.eventum,
                name=f"Event {idx}",
                start_time=now + timedelta(days=idx + 1),
                end_time=now + timedelta(days=idx + 1, hours=1),
            )
            event.participants.add(*participants)
            event.groups.add(group)
            event.tags.add(tag)

        url = reverse('event-upcoming', kwargs={'eventum_slug': self.eventum.slug})
        with self.assertNumQueries(9):
            response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 5)

    def test_locations_tree_builds_single_query_map(self):
        parent = Location.objects.create(eventum=self.eventum, name="Venue", kind=Location.Kind.VENUE)
        buildings = [
            Location.objects.create(eventum=self.eventum, name=f"Building {idx}", kind=Location.Kind.BUILDING, parent=parent)
            for idx in range(3)
        ]
        for building in buildings:
            for idx in range(3):
                Location.objects.create(
                    eventum=self.eventum,
                    name=f"Room {building.name}-{idx}",
                    kind=Location.Kind.ROOM,
                    parent=building,
                )

        url = reverse('location-tree', kwargs={'eventum_slug': self.eventum.slug})
        with self.assertNumQueries(4):
            response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_user_roles_endpoint_avoids_n_plus_one(self):
        for idx in range(5):
            new_eventum = Eventum.objects.create(name=f"Managed {idx}")
            UserRole.objects.create(user=self.user, eventum=new_eventum, role='organizer')

        url = reverse('user_roles')
        with self.assertNumQueries(2):
            response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 6)  # 5 new + 1 from setUp

    def test_group_creation_bulk_related_fields(self):
        participants = [
            Participant.objects.create(eventum=self.eventum, name=f"Member {idx}")
            for idx in range(5)
        ]
        tags = [
            GroupTag.objects.create(eventum=self.eventum, name=f"Tag {idx}")
            for idx in range(3)
        ]

        url = reverse('participantgroup-list', kwargs={'eventum_slug': self.eventum.slug})
        payload = {
            'name': 'Bulk Group',
            'participants': [p.id for p in participants],
            'tag_ids': [tag.id for tag in tags],
        }

        with self.assertNumQueries(8):
            response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_group_update_bulk_related_fields(self):
        participants = [
            Participant.objects.create(eventum=self.eventum, name=f"Member {idx}")
            for idx in range(6)
        ]
        tags = [
            GroupTag.objects.create(eventum=self.eventum, name=f"Tag {idx}")
            for idx in range(4)
        ]

        group = ParticipantGroup.objects.create(eventum=self.eventum, name="Original Group")
        group.participants.set(participants[:3])
        group.tags.set(tags[:2])

        url = reverse('participantgroup-detail', kwargs={'eventum_slug': self.eventum.slug, 'pk': group.id})
        payload = {
            'name': 'Updated Group',
            'participants': [p.id for p in participants[2:]],
            'tag_ids': [tag.id for tag in tags[1:]],
        }

        with self.assertNumQueries(15):
            response = self.client.put(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_event_creation_bulk_related_fields(self):
        participants = [
            Participant.objects.create(eventum=self.eventum, name=f"Participant {idx}")
            for idx in range(5)
        ]
        groups = [
            ParticipantGroup.objects.create(eventum=self.eventum, name=f"Group {idx}")
            for idx in range(2)
        ]
        for group in groups:
            group.participants.set(participants)

        tags = [
            EventTag.objects.create(eventum=self.eventum, name=f"Tag {idx}")
            for idx in range(3)
        ]

        url = reverse('event-list', kwargs={'eventum_slug': self.eventum.slug})
        now = timezone.now()
        payload = {
            'name': 'Bulk Event',
            'start_time': (now + timedelta(hours=1)).isoformat(),
            'end_time': (now + timedelta(hours=2)).isoformat(),
            'participants': [p.id for p in participants],
            'groups': [group.id for group in groups],
            'tag_ids': [tag.id for tag in tags],
        }

        with self.assertNumQueries(11):
            response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_event_update_bulk_related_fields(self):
        participants = [
            Participant.objects.create(eventum=self.eventum, name=f"Participant {idx}")
            for idx in range(4)
        ]
        groups = [
            ParticipantGroup.objects.create(eventum=self.eventum, name=f"Group {idx}")
            for idx in range(2)
        ]
        for group in groups:
            group.participants.set(participants)

        tags = [
            EventTag.objects.create(eventum=self.eventum, name=f"Tag {idx}")
            for idx in range(2)
        ]

        event = Event.objects.create(
            eventum=self.eventum,
            name='Existing Event',
            start_time=timezone.now() + timedelta(hours=1),
            end_time=timezone.now() + timedelta(hours=2),
        )
        event.participants.set(participants[:2])
        event.groups.set(groups[:1])
        event.tags.set(tags[:1])

        url = reverse('event-detail', kwargs={'eventum_slug': self.eventum.slug, 'pk': event.id})
        payload = {
            'name': 'Existing Event',
            'start_time': (timezone.now() + timedelta(hours=3)).isoformat(),
            'end_time': (timezone.now() + timedelta(hours=4)).isoformat(),
            'participants': [p.id for p in participants],
            'groups': [group.id for group in groups],
            'tag_ids': [tag.id for tag in tags],
        }

        with self.assertNumQueries(22):
            response = self.client.put(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)


class EventParticipantTypeValidationTests(TestCase):
    """Тесты для валидации изменения participant_type с manual на другие типы"""
    
    def setUp(self):
        self.eventum = Eventum.objects.create(name="Test Eventum")
        self.participant = Participant.objects.create(eventum=self.eventum, name="Test Participant")
        self.group = ParticipantGroup.objects.create(eventum=self.eventum, name="Test Group")
        self.group.participants.add(self.participant)
        self.event_tag = EventTag.objects.create(eventum=self.eventum, name="Test Event Tag")
        self.group_tag = GroupTag.objects.create(eventum=self.eventum, name="Test Group Tag")
        
        # Создаем событие с типом manual
        now = timezone.now()
        self.event = Event.objects.create(
            eventum=self.eventum,
            name="Manual Event",
            start_time=now + timedelta(hours=1),
            end_time=now + timedelta(hours=2),
            participant_type=Event.ParticipantType.MANUAL
        )

    def test_cannot_change_from_manual_to_all_with_participants(self):
        """Нельзя изменить тип с manual на all, если есть участники"""
        self.event.participants.add(self.participant)
        
        self.event.participant_type = Event.ParticipantType.ALL
        
        with self.assertRaises(ValidationError) as context:
            self.event.full_clean()
        
        self.assertIn("Нельзя изменить тип участников с 'manual' на другой тип", str(context.exception))

    def test_cannot_change_from_manual_to_registration_with_groups(self):
        """Нельзя изменить тип с manual на registration, если есть группы"""
        self.event.groups.add(self.group)
        
        self.event.participant_type = Event.ParticipantType.REGISTRATION
        self.event.max_participants = 10
        
        with self.assertRaises(ValidationError) as context:
            self.event.full_clean()
        
        self.assertIn("Нельзя изменить тип участников с 'manual' на другой тип", str(context.exception))

    def test_can_change_from_manual_to_all_with_event_tags(self):
        """Можно изменить тип с manual на all, даже если есть теги событий"""
        self.event.tags.add(self.event_tag)
        
        self.event.participant_type = Event.ParticipantType.ALL
        
        # Не должно быть ошибок валидации
        self.event.full_clean()

    def test_cannot_change_from_manual_to_all_with_group_tags(self):
        """Нельзя изменить тип с manual на all, если есть теги групп"""
        self.event.group_tags.add(self.group_tag)
        
        self.event.participant_type = Event.ParticipantType.ALL
        
        with self.assertRaises(ValidationError) as context:
            self.event.full_clean()
        
        self.assertIn("Нельзя изменить тип участников с 'manual' на другой тип", str(context.exception))

    def test_can_change_from_manual_to_other_when_no_connections(self):
        """Можно изменить тип с manual на другой, если нет связей"""
        # Убеждаемся, что нет связей
        self.assertEqual(self.event.participants.count(), 0)
        self.assertEqual(self.event.groups.count(), 0)
        self.assertEqual(self.event.tags.count(), 0)
        self.assertEqual(self.event.group_tags.count(), 0)
        
        # Меняем тип
        self.event.participant_type = Event.ParticipantType.ALL
        
        # Не должно быть ошибок валидации
        self.event.full_clean()

    def test_can_change_from_manual_after_removing_connections(self):
        """Можно изменить тип с manual после удаления всех связей"""
        # Добавляем связи
        self.event.participants.add(self.participant)
        self.event.groups.add(self.group)
        self.event.tags.add(self.event_tag)
        self.event.group_tags.add(self.group_tag)
        
        # Удаляем все связи
        self.event.participants.clear()
        self.event.groups.clear()
        self.event.tags.clear()
        self.event.group_tags.clear()
        
        # Теперь можно изменить тип
        self.event.participant_type = Event.ParticipantType.ALL
        self.event.full_clean()

    def test_can_change_to_manual_with_existing_connections(self):
        """Можно изменить тип на manual, даже если есть связи"""
        # Создаем событие с типом all
        now = timezone.now()
        event = Event.objects.create(
            eventum=self.eventum,
            name="All Event",
            start_time=now + timedelta(hours=1),
            end_time=now + timedelta(hours=2),
            participant_type=Event.ParticipantType.ALL
        )
        
        # Добавляем связи
        event.participants.add(self.participant)
        event.groups.add(self.group)
        event.tags.add(self.event_tag)
        event.group_tags.add(self.group_tag)
        
        # Меняем на manual - это должно работать
        event.participant_type = Event.ParticipantType.MANUAL
        event.full_clean()


class EventParticipantTypeAPITests(APITestCase):
    """API тесты для валидации изменения participant_type"""
    
    def setUp(self):
        self.user = UserProfile.objects.create_user(
            vk_id=6001,
            name="API Test User",
            email="api@example.com",
        )
        self.eventum = Eventum.objects.create(name="API Test Eventum")
        UserRole.objects.create(user=self.user, eventum=self.eventum, role='organizer')

        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}")

        # Создаем тестовые данные
        self.participant = Participant.objects.create(eventum=self.eventum, name="API Participant")
        self.group = ParticipantGroup.objects.create(eventum=self.eventum, name="API Group")
        self.group.participants.add(self.participant)
        self.event_tag = EventTag.objects.create(eventum=self.eventum, name="API Event Tag")
        self.group_tag = GroupTag.objects.create(eventum=self.eventum, name="API Group Tag")
        
        # Создаем событие с типом manual
        now = timezone.now()
        self.event = Event.objects.create(
            eventum=self.eventum,
            name="API Manual Event",
            start_time=now + timedelta(hours=1),
            end_time=now + timedelta(hours=2),
            participant_type=Event.ParticipantType.MANUAL
        )

    def test_api_rejects_participant_type_change_with_participants(self):
        """API отклоняет изменение типа с manual на другой, если есть участники"""
        self.event.participants.add(self.participant)
        
        url = reverse('event-detail', kwargs={'eventum_slug': self.eventum.slug, 'pk': self.event.id})
        payload = {
            'name': 'API Manual Event',
            'start_time': (timezone.now() + timedelta(hours=1)).isoformat(),
            'end_time': (timezone.now() + timedelta(hours=2)).isoformat(),
            'participant_type': 'all',
            'participants': [self.participant.id],
        }
        
        response = self.client.put(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('participant_type', response.data)
        self.assertIn('Нельзя изменить тип участников с "manual" на другой тип', str(response.data['participant_type']))

    def test_api_rejects_participant_type_change_with_groups(self):
        """API отклоняет изменение типа с manual на другой, если есть группы"""
        self.event.groups.add(self.group)
        
        url = reverse('event-detail', kwargs={'eventum_slug': self.eventum.slug, 'pk': self.event.id})
        payload = {
            'name': 'API Manual Event',
            'start_time': (timezone.now() + timedelta(hours=1)).isoformat(),
            'end_time': (timezone.now() + timedelta(hours=2)).isoformat(),
            'participant_type': 'registration',
            'max_participants': 10,
            'groups': [self.group.id],
        }
        
        response = self.client.put(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('participant_type', response.data)
        self.assertIn('Нельзя изменить тип участников с "manual" на другой тип', str(response.data['participant_type']))

    def test_api_allows_participant_type_change_with_event_tags(self):
        """API разрешает изменение типа с manual на другой, если есть только теги событий"""
        self.event.tags.add(self.event_tag)
        
        url = reverse('event-detail', kwargs={'eventum_slug': self.eventum.slug, 'pk': self.event.id})
        payload = {
            'name': 'API Manual Event',
            'start_time': (timezone.now() + timedelta(hours=1)).isoformat(),
            'end_time': (timezone.now() + timedelta(hours=2)).isoformat(),
            'participant_type': 'all',
            'tag_ids': [self.event_tag.id],
        }
        
        response = self.client.put(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_api_rejects_participant_type_change_with_group_tags(self):
        """API отклоняет изменение типа с manual на другой, если есть теги групп"""
        self.event.group_tags.add(self.group_tag)
        
        url = reverse('event-detail', kwargs={'eventum_slug': self.eventum.slug, 'pk': self.event.id})
        payload = {
            'name': 'API Manual Event',
            'start_time': (timezone.now() + timedelta(hours=1)).isoformat(),
            'end_time': (timezone.now() + timedelta(hours=2)).isoformat(),
            'participant_type': 'all',
            'group_tag_ids': [self.group_tag.id],
        }
        
        response = self.client.put(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('participant_type', response.data)
        self.assertIn('Нельзя изменить тип участников с "manual" на другой тип', str(response.data['participant_type']))

    def test_api_allows_participant_type_change_after_removing_blocking_connections(self):
        """API разрешает изменение типа после удаления блокирующих связей"""
        # Добавляем блокирующие связи (участники, группы, теги групп)
        self.event.participants.add(self.participant)
        self.event.groups.add(self.group)
        self.event.group_tags.add(self.group_tag)
        # Добавляем теги событий (не блокирующие)
        self.event.tags.add(self.event_tag)
        
        # Сначала удаляем только блокирующие связи
        url = reverse('event-detail', kwargs={'eventum_slug': self.eventum.slug, 'pk': self.event.id})
        payload = {
            'name': 'API Manual Event',
            'start_time': (timezone.now() + timedelta(hours=1)).isoformat(),
            'end_time': (timezone.now() + timedelta(hours=2)).isoformat(),
            'participant_type': 'manual',
            'participants': [],
            'groups': [],
            'group_tag_ids': [],
            'tag_ids': [self.event_tag.id],  # Оставляем теги событий
        }
        
        response = self.client.put(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Теперь меняем тип (теги событий не должны блокировать)
        payload['participant_type'] = 'all'
        response = self.client.put(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_api_allows_changing_to_manual_with_existing_connections(self):
        """API разрешает изменение типа на manual, даже если есть связи"""
        # Создаем событие с типом all
        now = timezone.now()
        event = Event.objects.create(
            eventum=self.eventum,
            name="API All Event",
            start_time=now + timedelta(hours=1),
            end_time=now + timedelta(hours=2),
            participant_type=Event.ParticipantType.ALL
        )
        
        # Добавляем связи
        event.participants.add(self.participant)
        event.groups.add(self.group)
        event.tags.add(self.event_tag)
        event.group_tags.add(self.group_tag)
        
        # Меняем на manual
        url = reverse('event-detail', kwargs={'eventum_slug': self.eventum.slug, 'pk': event.id})
        payload = {
            'name': 'API All Event',
            'start_time': (timezone.now() + timedelta(hours=1)).isoformat(),
            'end_time': (timezone.now() + timedelta(hours=2)).isoformat(),
            'participant_type': 'manual',
            'participants': [self.participant.id],
            'groups': [self.group.id],
            'tag_ids': [self.event_tag.id],
            'group_tag_ids': [self.group_tag.id],
        }
        
        response = self.client.put(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_api_allows_participant_type_change_when_removing_connections_in_same_request(self):
        """API разрешает изменение типа с manual на другой, если удаляются связи в том же запросе"""
        # Добавляем связи к событию
        self.event.participants.add(self.participant)
        self.event.groups.add(self.group)
        self.event.group_tags.add(self.group_tag)
        
        url = reverse('event-detail', kwargs={'eventum_slug': self.eventum.slug, 'pk': self.event.id})
        payload = {
            'name': 'API Manual Event',
            'start_time': (timezone.now() + timedelta(hours=1)).isoformat(),
            'end_time': (timezone.now() + timedelta(hours=2)).isoformat(),
            'participant_type': 'registration',
            'max_participants': 10,
            'participants': [],  # Удаляем всех участников
            'groups': [],        # Удаляем все группы
            'group_tag_ids': [], # Удаляем все теги групп
            'tag_ids': [self.event_tag.id],  # Оставляем теги событий
        }
        
        response = self.client.put(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Проверяем, что тип действительно изменился
        self.event.refresh_from_db()
        self.assertEqual(self.event.participant_type, Event.ParticipantType.REGISTRATION)
        self.assertEqual(self.event.max_participants, 10)
