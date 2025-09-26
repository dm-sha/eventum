from django.db import models
from django.core.exceptions import ValidationError
from django.utils.text import slugify
from django.utils import timezone
from django.contrib.auth.models import AbstractUser, BaseUserManager

class Eventum(models.Model):
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True)
    
    def __str__(self):
        return self.name

class Participant(models.Model):
    eventum = models.ForeignKey(Eventum, on_delete=models.CASCADE, related_name='participants')
    name = models.CharField(max_length=200)
    
    def __str__(self):
        return f"{self.name} ({self.eventum.name})"

class GroupTag(models.Model):
    eventum = models.ForeignKey(Eventum, on_delete=models.CASCADE, related_name='group_tags')
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100)
    
    class Meta:
        unique_together = ('eventum', 'slug')
    
    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        self.full_clean()
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.name} ({self.eventum.name})"

class ParticipantGroup(models.Model):
    eventum = models.ForeignKey(Eventum, on_delete=models.CASCADE, related_name='participant_groups')
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200)
    participants = models.ManyToManyField(Participant, related_name='groups')
    tags = models.ManyToManyField(GroupTag, related_name='groups', blank=True)
    
    class Meta:
        unique_together = ('eventum', 'slug')
    
    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        self.full_clean()
        super().save(*args, **kwargs)
    
    def clean(self):
        # Ensure all participants belong to the same eventum
        for participant in self.participants.all():
            if participant.eventum != self.eventum:
                raise ValidationError(
                    f"Participant {participant.name} belongs to a different eventum"
                )
    
    def __str__(self):
        return f"{self.name} ({self.eventum.name})"

class EventTag(models.Model):
    eventum = models.ForeignKey(Eventum, on_delete=models.CASCADE, related_name='event_tags')
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100)

    class Meta:
        unique_together = ('eventum', 'slug')

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.eventum.name})"

class Event(models.Model):
    eventum = models.ForeignKey(Eventum, on_delete=models.CASCADE, related_name='events')
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    participants = models.ManyToManyField(
        Participant, 
        related_name='individual_events',
        blank=True
    )
    groups = models.ManyToManyField(
        ParticipantGroup, 
        related_name='events',
        blank=True
    )
    tags = models.ManyToManyField(EventTag, related_name='events', blank=True)
    
    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
    
    def clean(self):
        # Ensure end time is after start time
        if self.end_time <= self.start_time:
            raise ValidationError("End time must be after start time")
        
        # Ensure all participants belong to the same eventum
        for participant in self.participants.all():
            if participant.eventum != self.eventum:
                raise ValidationError(
                    f"Participant {participant.name} belongs to a different eventum"
                )
        
        # Ensure all groups belong to the same eventum
        for group in self.groups.all():
            if group.eventum != self.eventum:
                raise ValidationError(
                    f"Group {group.name} belongs to a different eventum"
                )
    
    def __str__(self):
        return f"{self.name} ({self.eventum.name})"


class UserProfileManager(BaseUserManager):
    """Кастомный менеджер для UserProfile"""
    
    def create_user(self, vk_id, name='', email='', password=None, **extra_fields):
        if not vk_id:
            raise ValueError('VK ID обязателен')
        
        user = self.model(
            vk_id=vk_id,
            name=name,
            email=email,
            **extra_fields
        )
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()  # Пароль не используется для VK авторизации
        user.save(using=self._db)
        return user
    
    def create_superuser(self, vk_id, name='', email='', password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
        
        return self.create_user(vk_id, name, email, password, **extra_fields)


class UserProfile(AbstractUser):
    """Профиль пользователя с данными из VK"""
    vk_id = models.BigIntegerField(unique=True, null=True, blank=True)
    name = models.CharField(max_length=200, blank=True)
    avatar_url = models.URLField(blank=True)
    email = models.EmailField(blank=True)
    
    # Убираем поле username, так как используем vk_id
    username = None
    # Оставляем password для админки Django
    
    # Используем кастомный менеджер
    objects = UserProfileManager()
    
    # Исправляем конфликты с related_name
    groups = models.ManyToManyField(
        'auth.Group',
        verbose_name='groups',
        blank=True,
        help_text='The groups this user belongs to.',
        related_name="userprofile_set",
        related_query_name="userprofile",
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        verbose_name='user permissions',
        blank=True,
        help_text='Specific permissions for this user.',
        related_name="userprofile_set",
        related_query_name="userprofile",
    )
    
    USERNAME_FIELD = 'vk_id'
    REQUIRED_FIELDS = []
    
    def __str__(self):
        return f"{self.name} (VK: {self.vk_id})"


class UserRole(models.Model):
    """Роли пользователей для конкретных eventum'ов"""
    ROLE_CHOICES = [
        ('organizer', 'Организатор'),
        ('participant', 'Участник'),
    ]
    
    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='roles')
    eventum = models.ForeignKey(Eventum, on_delete=models.CASCADE, related_name='user_roles')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('user', 'eventum', 'role')
        verbose_name = 'User Role'
        verbose_name_plural = 'User Roles'
    
    def __str__(self):
        return f"{self.user.name} - {self.get_role_display()} в {self.eventum.name}"
