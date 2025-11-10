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
    Location,
    Participant,
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


    def test_event_creation_bulk_related_fields(self):
        participants = [
            Participant.objects.create(eventum=self.eventum, name=f"Participant {idx}")
            for idx in range(5)
        ]

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
        event.tags.set(tags[:1])

        url = reverse('event-detail', kwargs={'eventum_slug': self.eventum.slug, 'pk': event.id})
        payload = {
            'name': 'Existing Event',
            'start_time': (timezone.now() + timedelta(hours=3)).isoformat(),
            'end_time': (timezone.now() + timedelta(hours=4)).isoformat(),
            'participants': [p.id for p in participants],
            'tag_ids': [tag.id for tag in tags],
        }

        with self.assertNumQueries(22):
            response = self.client.put(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
