from datetime import timedelta
import json

from django.test import TestCase
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Eventum, Participant, ParticipantGroup, GroupTag, EventTag, UserProfile


class EventModelTest(TestCase):
    def setUp(self):
        self.eventum1 = Eventum.objects.create(
            name="Eventum 1", slug="eventum-1"
        )
        self.eventum2 = Eventum.objects.create(
            name="Eventum 2", slug="eventum-2"
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


class ParticipantGroupAPITest(APITestCase):
    def setUp(self):
        # Создаем пользователя для аутентификации
        self.user = UserProfile.objects.create_user(
            vk_id=999999999,
            name="Test User",
            email="test@example.com"
        )
        
        # Создаем eventum
        self.eventum = Eventum.objects.create(
            name="Test Eventum",
            slug="test-eventum"
        )
        
        # Создаем участников
        self.participant1 = Participant.objects.create(
            eventum=self.eventum,
            name="Participant 1"
        )
        self.participant2 = Participant.objects.create(
            eventum=self.eventum,
            name="Participant 2"
        )
        self.participant3 = Participant.objects.create(
            eventum=self.eventum,
            name="Participant 3"
        )
        
        # Создаем тег группы
        self.group_tag = GroupTag.objects.create(
            eventum=self.eventum,
            name="Test Tag"
        )
        
        # Создаем роль пользователя для eventum
        from .models import UserRole
        UserRole.objects.create(
            user=self.user,
            eventum=self.eventum,
            role='organizer'
        )
        
        # Получаем JWT токен
        refresh = RefreshToken.for_user(self.user)
        self.access_token = str(refresh.access_token)
        
        # Настраиваем аутентификацию
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.access_token}')

    def test_create_group_without_participants(self):
        """Тест создания группы без участников"""
        url = reverse('participantgroup-list', kwargs={'eventum_slug': self.eventum.slug})
        data = {
            'name': 'Test Group'
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ParticipantGroup.objects.count(), 1)
        
        group = ParticipantGroup.objects.first()
        self.assertEqual(group.name, 'Test Group')
        self.assertEqual(group.eventum, self.eventum)
        self.assertEqual(group.slug, 'test-group')
        self.assertEqual(group.participants.count(), 0)

    def test_create_group_with_participants(self):
        """Тест создания группы с участниками"""
        url = reverse('participantgroup-list', kwargs={'eventum_slug': self.eventum.slug})
        data = {
            'name': 'Test Group with Participants',
            'participants': [self.participant1.id, self.participant2.id]
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ParticipantGroup.objects.count(), 1)
        
        group = ParticipantGroup.objects.first()
        self.assertEqual(group.name, 'Test Group with Participants')
        self.assertEqual(group.eventum, self.eventum)
        self.assertEqual(group.slug, 'test-group-with-participants')
        self.assertEqual(group.participants.count(), 2)
        self.assertIn(self.participant1, group.participants.all())
        self.assertIn(self.participant2, group.participants.all())

    def test_create_group_with_tags(self):
        """Тест создания группы с тегами"""
        url = reverse('participantgroup-list', kwargs={'eventum_slug': self.eventum.slug})
        data = {
            'name': 'Test Group with Tags',
            'participants': [self.participant1.id],
            'tag_ids': [self.group_tag.id]
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ParticipantGroup.objects.count(), 1)
        
        group = ParticipantGroup.objects.first()
        self.assertEqual(group.name, 'Test Group with Tags')
        self.assertEqual(group.participants.count(), 1)
        self.assertEqual(group.tags.count(), 1)
        self.assertIn(self.group_tag, group.tags.all())

    def test_create_group_with_invalid_participants(self):
        """Тест создания группы с участниками из другого eventum"""
        # Создаем другой eventum и участника
        other_eventum = Eventum.objects.create(
            name="Other Eventum",
            slug="other-eventum"
        )
        other_participant = Participant.objects.create(
            eventum=other_eventum,
            name="Other Participant"
        )
        
        url = reverse('participantgroup-list', kwargs={'eventum_slug': self.eventum.slug})
        data = {
            'name': 'Test Group',
            'participants': [self.participant1.id, other_participant.id]
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('принадлежат другому мероприятию', str(response.data))

    def test_create_group_auto_slug_generation(self):
        """Тест автоматической генерации slug"""
        url = reverse('participantgroup-list', kwargs={'eventum_slug': self.eventum.slug})
        data = {
            'name': 'Группа с русским названием и спец. символами!'
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Проверяем, что slug сохранился в базе данных
        group = ParticipantGroup.objects.first()
        self.assertEqual(group.slug, 'gruppa-s-russkim-nazvaniem-i-spets-simvolami')

    def test_create_group_requires_authentication(self):
        """Тест что создание группы требует аутентификации"""
        self.client.credentials()  # Убираем аутентификацию
        
        url = reverse('participantgroup-list', kwargs={'eventum_slug': self.eventum.slug})
        data = {
            'name': 'Test Group'
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_group_requires_organizer_role(self):
        """Тест что создание группы требует роли организатора"""
        # Создаем пользователя без роли организатора
        other_user = UserProfile.objects.create_user(
            vk_id=888888888,
            name="Other User",
            email="other@example.com"
        )
        
        # Создаем роль участника (не организатора)
        from .models import UserRole
        UserRole.objects.create(
            user=other_user,
            eventum=self.eventum,
            role='participant'
        )
        
        # Получаем токен для другого пользователя
        refresh = RefreshToken.for_user(other_user)
        other_access_token = str(refresh.access_token)
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {other_access_token}')
        
        url = reverse('participantgroup-list', kwargs={'eventum_slug': self.eventum.slug})
        data = {
            'name': 'Test Group'
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class SlugGenerationTest(TestCase):
    def setUp(self):
        self.eventum = Eventum.objects.create(
            name="Test Eventum",
            slug="test-eventum"
        )

    def test_group_tag_slug_generation(self):
        """Тест генерации slug для GroupTag с русским текстом"""
        tag = GroupTag.objects.create(
            eventum=self.eventum,
            name="Тег с русским названием"
        )
        self.assertEqual(tag.slug, 'teg-s-russkim-nazvaniem')

    def test_event_tag_slug_generation(self):
        """Тест генерации slug для EventTag с русским текстом"""
        tag = EventTag.objects.create(
            eventum=self.eventum,
            name="Событие с русским названием"
        )
        self.assertEqual(tag.slug, 'sobytie-s-russkim-nazvaniem')

    def test_participant_group_slug_generation(self):
        """Тест генерации slug для ParticipantGroup с русским текстом"""
        group = ParticipantGroup.objects.create(
            eventum=self.eventum,
            name="Группа с русским названием"
        )
        self.assertEqual(group.slug, 'gruppa-s-russkim-nazvaniem')

    def test_slug_generation_with_special_characters(self):
        """Тест генерации slug с специальными символами"""
        tag = GroupTag.objects.create(
            eventum=self.eventum,
            name="Тег с спец. символами!@#$%^&*()"
        )
        self.assertEqual(tag.slug, 'teg-s-spets-simvolami')

    def test_slug_generation_with_numbers(self):
        """Тест генерации slug с цифрами"""
        tag = GroupTag.objects.create(
            eventum=self.eventum,
            name="Тег 123 с цифрами 456"
        )
        self.assertEqual(tag.slug, 'teg-123-s-tsiframi-456')
