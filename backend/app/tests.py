from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from django.core.exceptions import ValidationError

from .models import Eventum, Participant, Event


class EventModelTest(TestCase):
    def setUp(self):
        self.eventum1 = Eventum.objects.create(
            name="Eventum 1", slug="eventum-1", password_hash="hash1"
        )
        self.eventum2 = Eventum.objects.create(
            name="Eventum 2", slug="eventum-2", password_hash="hash2"
        )
        self.participant1 = Participant.objects.create(
            eventum=self.eventum1, name="Participant 1"
        )
        self.participant2 = Participant.objects.create(
            eventum=self.eventum2, name="Participant 2"
        )
        self.event = Event.objects.create(
            eventum=self.eventum1,
            name="Sample Event",
            start_time=timezone.now(),
            end_time=timezone.now() + timedelta(hours=1),
        )

    def test_clean_allows_same_eventum_participants(self):
        self.event.participants.add(self.participant1)
        # Should not raise any validation errors
        self.event.full_clean()

    def test_clean_rejects_cross_eventum_participants(self):
        self.event.participants.add(self.participant1, self.participant2)
        with self.assertRaises(ValidationError):
            self.event.full_clean()
