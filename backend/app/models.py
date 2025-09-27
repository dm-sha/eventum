from django.db import models
from django.core.exceptions import ValidationError
from django.utils.text import slugify
from transliterate import translit
from django.utils import timezone
from django.contrib.auth.models import AbstractUser, BaseUserManager

class Eventum(models.Model):
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True)
    description = models.TextField(blank=True)
    
    def save(self, *args, **kwargs):
        if not self.slug:
            # Сначала транслитерируем русский текст в латиницу, затем создаем slug
            transliterated = translit(self.name, 'ru', reversed=True)
            self.slug = slugify(transliterated)
        super().save(*args, **kwargs)
    
    def __str__(self):
        return self.name

class Participant(models.Model):
    eventum = models.ForeignKey(Eventum, on_delete=models.CASCADE, related_name='participants')
    user = models.ForeignKey('UserProfile', on_delete=models.CASCADE, related_name='participants', null=True, blank=True)
    name = models.CharField(max_length=200)
    
    class Meta:
        unique_together = ('user', 'eventum')
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'eventum'],
                name='unique_user_per_eventum'
            )
        ]
    
    def clean(self):
        # Валидация: если указан пользователь, то имя должно соответствовать имени пользователя
        if self.user and self.name != self.user.name:
            self.name = self.user.name
    
    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
    
    def __str__(self):
        if self.user:
            return f"{self.user.name} ({self.eventum.name})"
        return f"{self.name} ({self.eventum.name})"

class GroupTag(models.Model):
    eventum = models.ForeignKey(Eventum, on_delete=models.CASCADE, related_name='group_tags')
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100, blank=True)
    
    class Meta:
        unique_together = ('eventum', 'slug')
    
    def save(self, *args, **kwargs):
        if not self.slug:
            # Сначала транслитерируем русский текст в латиницу, затем создаем slug
            transliterated = translit(self.name, 'ru', reversed=True)
            self.slug = slugify(transliterated)
        self.full_clean()
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.name} ({self.eventum.name})"

class ParticipantGroup(models.Model):
    eventum = models.ForeignKey(Eventum, on_delete=models.CASCADE, related_name='participant_groups')
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, blank=True)
    participants = models.ManyToManyField(Participant, related_name='groups')
    tags = models.ManyToManyField(GroupTag, related_name='groups', blank=True)
    
    class Meta:
        unique_together = ('eventum', 'slug')
    
    def save(self, *args, **kwargs):
        if not self.slug:
            # Сначала транслитерируем русский текст в латиницу, затем создаем slug
            transliterated = translit(self.name, 'ru', reversed=True)
            self.slug = slugify(transliterated)
        self.full_clean()
        super().save(*args, **kwargs)
    
    def clean(self):
        # Many-to-many relations are unavailable until the instance is saved,
        # so we skip the validation for unsaved objects (they will be validated
        # once the relations are assigned after creation).
        if not self.pk:
            return

        # Ensure all participants belong to the same eventum
        # Only check if we have an eventum and participants
        if self.eventum_id and self.participants.exists():
            # Оптимизируем запрос - проверяем только участников с другим eventum
            invalid_participants = self.participants.filter(eventum__isnull=False).exclude(eventum=self.eventum)
            if invalid_participants.exists():
                # Используем values_list для более эффективного запроса
                invalid_names = list(invalid_participants.values_list('name', flat=True))
                raise ValidationError(
                    f"Participants {', '.join(invalid_names)} belong to different eventums"
                )
    
    def __str__(self):
        return f"{self.name} ({self.eventum.name})"

class EventTag(models.Model):
    eventum = models.ForeignKey(Eventum, on_delete=models.CASCADE, related_name='event_tags')
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100, blank=True)

    class Meta:
        unique_together = ('eventum', 'slug')

    def save(self, *args, **kwargs):
        if not self.slug:
            # Сначала транслитерируем русский текст в латиницу, затем создаем slug
            transliterated = translit(self.name, 'ru', reversed=True)
            self.slug = slugify(transliterated)
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
    avatar_url = models.TextField(blank=True)  # Увеличиваем лимит для длинных URL
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
