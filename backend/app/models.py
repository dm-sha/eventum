from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.signals import post_save, m2m_changed
from django.dispatch import receiver
from django.utils import timezone

from .utils import generate_unique_slug

class Eventum(models.Model):
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True)
    description = models.TextField(blank=True)
    image_url = models.URLField(
        blank=True,
        help_text="URL изображения для eventum"
    )
    registration_open = models.BooleanField(
        default=True,
        help_text="Открыта ли регистрация на мероприятия"
    )

    def save(self, *args, **kwargs):
        # Если slug не предоставлен, генерируем его из названия
        if not self.slug:
            self.slug = generate_unique_slug(self, self.name)
        # Если slug предоставлен, но уже существует, делаем его уникальным
        elif Eventum.objects.exclude(pk=self.pk).filter(slug=self.slug).exists():
            self.slug = generate_unique_slug(self, self.slug)
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
        indexes = [
            models.Index(fields=['eventum']),  # Для фильтрации по eventum
            models.Index(fields=['user']),     # Для поиска по пользователю
            models.Index(fields=['name']),     # Для поиска по имени
        ]
    
    def clean(self):
        # Валидация: если указан пользователь, но имя не задано, используем имя пользователя
        if self.user and not self.name:
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
        indexes = [
            models.Index(fields=['eventum']),  # Для фильтрации по eventum
            models.Index(fields=['name']),     # Для поиска по имени
        ]
    
    def save(self, *args, **kwargs):
        if not self.slug or GroupTag.objects.filter(eventum=self.eventum, slug=self.slug).exclude(pk=self.pk).exists():
            base_value = self.name if not self.slug else self.slug
            self.slug = generate_unique_slug(self, base_value, scope_fields=['eventum'])
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
        indexes = [
            models.Index(fields=['eventum']),  # Для фильтрации по eventum
            models.Index(fields=['name']),     # Для поиска по имени
        ]
    
    def save(self, *args, **kwargs):
        if not self.slug or ParticipantGroup.objects.filter(eventum=self.eventum, slug=self.slug).exclude(pk=self.pk).exists():
            base_value = self.name if not self.slug else self.slug
            self.slug = generate_unique_slug(self, base_value, scope_fields=['eventum'])
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

    def clean(self):
        """Валидация тега мероприятий"""
        # Проверяем, что если тег связан с волной, то все мероприятия с этим тегом имеют тип 'registration'
        try:
            if hasattr(self, 'event_wave') and self.event_wave:
                events_with_tag = Event.objects.filter(
                    eventum=self.eventum,
                    tags=self
                ).exclude(participant_type=Event.ParticipantType.REGISTRATION)
                
                if events_with_tag.exists():
                    event_names = list(events_with_tag.values_list('name', flat=True))
                    raise ValidationError(
                        f"Все мероприятия с тегом '{self.name}' должны иметь тип участников 'По записи', "
                        f"так как тег связан с волной регистрации. "
                        f"Нарушающие мероприятия: {', '.join(event_names)}"
                    )
        except EventWave.DoesNotExist:
            # Тег не связан с волной, проверка не нужна
            pass

    def save(self, *args, **kwargs):
        if not self.slug or EventTag.objects.filter(eventum=self.eventum, slug=self.slug).exclude(pk=self.pk).exists():
            base_value = self.name if not self.slug else self.slug
            self.slug = generate_unique_slug(self, base_value, scope_fields=['eventum'])
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.eventum.name})"

class Event(models.Model):
    class ParticipantType(models.TextChoices):
        ALL = "all", "Для всех"
        REGISTRATION = "registration", "По записи"
        MANUAL = "manual", "Вручную"
    
    eventum = models.ForeignKey(Eventum, on_delete=models.CASCADE, related_name='events')
    locations = models.ManyToManyField('Location', related_name='events', blank=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    participant_type = models.CharField(
        max_length=20, 
        choices=ParticipantType.choices, 
        default=ParticipantType.ALL,
        help_text="Тип определения участников для мероприятия"
    )
    max_participants = models.PositiveIntegerField(
        null=True, 
        blank=True,
        help_text="Максимальное количество участников (используется только при типе 'По записи')"
    )
    image_url = models.URLField(
        blank=True,
        help_text="URL изображения для события"
    )
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
    group_tags = models.ManyToManyField(
        GroupTag, 
        related_name='events',
        blank=True
    )
    
    def save(self, *args, **kwargs):
        # Валидация происходит в сериализаторе
        super().save(*args, **kwargs)
    
    def clean(self):
        # Ensure end time is after start time
        if self.end_time <= self.start_time:
            raise ValidationError("End time must be after start time")
        
        # Validate participant type and max_participants
        if self.participant_type == self.ParticipantType.REGISTRATION:
            if not self.max_participants or self.max_participants <= 0:
                raise ValidationError("max_participants must be specified and greater than 0 for registration type events")
        elif self.participant_type in [self.ParticipantType.ALL, self.ParticipantType.MANUAL]:
            if self.max_participants is not None:
                raise ValidationError("max_participants should not be set for 'all' or 'manual' type events")
        
        # Check if trying to change participant_type from manual when there are existing connections
        if self.pk:
            # Get the original instance from database
            try:
                original = Event.objects.get(pk=self.pk)
                # If changing from manual to another type, check for existing connections
                if (original.participant_type == self.ParticipantType.MANUAL and 
                    self.participant_type != self.ParticipantType.MANUAL):
                    
                    # Check for participants
                    if self.participants.exists():
                        raise ValidationError(
                            "Нельзя изменить тип участников с 'manual' на другой тип, "
                            "пока не удалены все связи с участниками"
                        )
                    
                    # Check for groups
                    if self.groups.exists():
                        raise ValidationError(
                            "Нельзя изменить тип участников с 'manual' на другой тип, "
                            "пока не удалены все связи с группами"
                        )
                    
                    # Check for group tags
                    if self.group_tags.exists():
                        raise ValidationError(
                            "Нельзя изменить тип участников с 'manual' на другой тип, "
                            "пока не удалены все связи с тегами групп"
                        )
                
                # Валидация изменения participant_type у мероприятия, связанного с волной
                if self.participant_type != Event.ParticipantType.REGISTRATION:
                    # Проверяем, есть ли у этого мероприятия тег, связанный с волной
                    # Используем более эффективный запрос без .all()
                    event_waves_with_this_event_tag = EventWave.objects.filter(
                        eventum=self.eventum,
                        tag__events=self
                    )
                    
                    if event_waves_with_this_event_tag.exists():
                        wave_names = list(event_waves_with_this_event_tag.values_list('name', flat=True))
                        raise ValidationError(
                            f"Нельзя изменить тип участников мероприятия '{self.name}' на '{self.get_participant_type_display()}', "
                            f"так как оно связано с волной мероприятий: {', '.join(wave_names)}. "
                            f"Мероприятия в волне должны иметь тип участников 'По записи'"
                        )
                    
            except Event.DoesNotExist:
                # Object doesn't exist yet, no need to check
                pass
            
            # Ensure all participants belong to the same eventum (only if object is saved)
            # Оптимизированная проверка без .all()
            invalid_participants = self.participants.filter(eventum__ne=self.eventum)
            if invalid_participants.exists():
                participant_names = list(invalid_participants.values_list('name', flat=True))
                raise ValidationError(
                    f"Participants {', '.join(participant_names)} belong to a different eventum"
                )
            
            # Ensure all groups belong to the same eventum (only if object is saved)
            # Оптимизированная проверка без .all()
            invalid_groups = self.groups.filter(eventum__ne=self.eventum)
            if invalid_groups.exists():
                group_names = list(invalid_groups.values_list('name', flat=True))
                raise ValidationError(
                    f"Groups {', '.join(group_names)} belong to a different eventum"
                )
            
            # Проверяем, что мероприятие с типом "не по записи" не добавляется к тегам с волнами
            if self.participant_type != Event.ParticipantType.REGISTRATION:
                # Оптимизированная проверка без .all()
                tags_with_waves = EventWave.objects.filter(
                    tag__events=self
                ).values_list('tag__name', flat=True)
                
                if tags_with_waves.exists():
                    wave_tag_names = list(tags_with_waves)
                    raise ValidationError(
                        f"Нельзя добавить мероприятие с типом участников '{self.get_participant_type_display()}' "
                        f"к тегам, связанным с волнами регистрации: {', '.join(wave_tag_names)}. "
                        f"Мероприятия в волнах должны иметь тип участников 'По записи'"
                    )
            
            # Ensure all group tags belong to the same eventum (only if object is saved)
            # Оптимизированная проверка без .all()
            invalid_group_tags = self.group_tags.filter(eventum__ne=self.eventum)
            if invalid_group_tags.exists():
                group_tag_names = list(invalid_group_tags.values_list('name', flat=True))
                raise ValidationError(
                    f"Group tags {', '.join(group_tag_names)} belong to a different eventum"
                )
            
            # Ensure all locations belong to the same eventum (only if object is saved)
            # Оптимизированная проверка без .all()
            invalid_locations = self.locations.filter(eventum__ne=self.eventum)
            if invalid_locations.exists():
                location_names = list(invalid_locations.values_list('name', flat=True))
                raise ValidationError(
                    f"Locations {', '.join(location_names)} belong to a different eventum"
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


class Location(models.Model):
    """Локации для проведения мероприятий"""
    class Kind(models.TextChoices):
        VENUE = "venue", "Площадка/Территория"
        BUILDING = "building", "Здание/Корпус"
        ROOM = "room", "Аудитория/Кабинет"
        AREA = "area", "Зона/Outdoor"
        OTHER = "other", "Другое"

    eventum = models.ForeignKey(Eventum, on_delete=models.CASCADE, related_name='locations')
    parent = models.ForeignKey(
        "self", null=True, blank=True,
        on_delete=models.CASCADE, related_name="children"
    )
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, blank=True)
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.ROOM)
    address = models.CharField(max_length=300, blank=True)
    floor = models.CharField(max_length=20, blank=True)
    notes = models.TextField(blank=True)
    
    class Meta:
        unique_together = ('eventum', 'slug')
        verbose_name = 'Location'
        verbose_name_plural = 'Locations'
    
    def save(self, *args, **kwargs):
        if not self.slug or Location.objects.filter(eventum=self.eventum, slug=self.slug).exclude(pk=self.pk).exists():
            base_value = self.name if not self.slug else self.slug
            self.slug = generate_unique_slug(self, base_value, scope_fields=['eventum'])
        self.full_clean()
        super().save(*args, **kwargs)
    
    def clean(self):
        # Проверяем, что родительская локация принадлежит тому же eventum
        if self.parent and self.parent.eventum != self.eventum:
            raise ValidationError("Родительская локация должна принадлежать тому же мероприятию")
        
        # Проверяем иерархию типов локаций
        if self.parent:
            parent_kind = self.parent.kind
            current_kind = self.kind
            
            # Определяем допустимые иерархии
            valid_hierarchies = {
                'venue': ['building', 'area', 'other'],  # venue может содержать building, area или other
                'building': ['room', 'area', 'other'],   # building может содержать room, area или other
                'room': ['other'],                       # room может содержать other
                'area': ['other'],                       # area может содержать other
                'other': []                              # other не может содержать другие локации
            }
            
            if current_kind not in valid_hierarchies.get(parent_kind, []):
                parent_display = dict(self.Kind.choices)[parent_kind]
                current_display = dict(self.Kind.choices)[current_kind]
                raise ValidationError(
                    f"Локация типа '{current_display}' не может быть дочерней для локации типа '{parent_display}'"
                )
        
        # Проверяем на циклы в иерархии
        if self.parent:
            self._check_for_cycles()
    
    def _check_for_cycles(self):
        """Проверяет, не создается ли цикл в иерархии локаций"""
        visited = set()
        current = self.parent
        
        while current:
            if current.id in visited:
                raise ValidationError("Обнаружен цикл в иерархии локаций")
            if current.id == self.id:
                raise ValidationError("Локация не может быть родителем самой себе")
            visited.add(current.id)
            current = current.parent
    
    def __str__(self):
        return f"{self.name} ({self.eventum.name})"


class EventWave(models.Model):
    """Волна мероприятий - группа мероприятий, проходящих в одно время"""
    eventum = models.ForeignKey(Eventum, on_delete=models.CASCADE, related_name='event_waves')
    name = models.CharField(max_length=200, help_text="Название волны мероприятий")
    tag = models.OneToOneField(
        EventTag, 
        on_delete=models.CASCADE, 
        related_name='event_wave',
        help_text="Тег, связанный с волной (1 к 1)"
    )
    whitelist_groups = models.ManyToManyField(
        ParticipantGroup,
        related_name='whitelisted_waves',
        blank=True,
        help_text="Группы участников, которые могут записываться на волну (если пуст - доступны все группы)"
    )
    whitelist_group_tags = models.ManyToManyField(
        GroupTag,
        related_name='whitelisted_waves',
        blank=True,
        help_text="Теги групп участников, которые могут записываться на волну (если пуст - доступны все теги)"
    )
    blacklist_groups = models.ManyToManyField(
        ParticipantGroup,
        related_name='blacklisted_waves',
        blank=True,
        help_text="Группы участников, которые НЕ могут записываться на волну"
    )
    blacklist_group_tags = models.ManyToManyField(
        GroupTag,
        related_name='blacklisted_waves',
        blank=True,
        help_text="Теги групп участников, которые НЕ могут записываться на волну"
    )
    
    class Meta:
        unique_together = ('eventum', 'name')
        verbose_name = 'Event Wave'
        verbose_name_plural = 'Event Waves'
        indexes = [
            models.Index(fields=['eventum']),
            models.Index(fields=['name']),
        ]
    
    def clean(self):
        # Валидация: все мероприятия с тегом, связанным с волной, должны иметь participant_type = registration
        if self.tag_id:
            events_with_tag = Event.objects.filter(
                eventum=self.eventum,
                tags=self.tag
            ).exclude(participant_type=Event.ParticipantType.REGISTRATION)
            
            if events_with_tag.exists():
                event_names = list(events_with_tag.values_list('name', flat=True))
                raise ValidationError(
                    f"Все мероприятия с тегом '{self.tag.name}' должны иметь тип участников 'По записи'. "
                    f"Нарушающие мероприятия: {', '.join(event_names)}"
                )
    
    def is_available_for_participant(self, participant):
        """
        Проверяет, может ли участник записываться на волну.
        Условие: участник либо находится в whitelist (если он не пуст) 
        и не находится в blacklist (если он не пуст).
        """
        # Получаем все группы участника
        participant_groups = participant.groups.all()
        participant_group_tags = set()
        for group in participant_groups:
            participant_group_tags.update(group.tags.all())
        
        # Проверяем blacklist - если участник в blacklist, он не может подать заявку
        if self.blacklist_groups.exists():
            if participant_groups.filter(id__in=self.blacklist_groups.values_list('id', flat=True)).exists():
                return False
        
        if self.blacklist_group_tags.exists():
            if participant_group_tags.intersection(set(self.blacklist_group_tags.all())):
                return False
        
        # Проверяем whitelist - если он не пуст, участник должен быть в нем
        if self.whitelist_groups.exists():
            if not participant_groups.filter(id__in=self.whitelist_groups.values_list('id', flat=True)).exists():
                return False
        
        if self.whitelist_group_tags.exists():
            if not participant_group_tags.intersection(set(self.whitelist_group_tags.all())):
                return False
        
        return True
    
    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.name} ({self.eventum.name})"


class EventRegistration(models.Model):
    """Заявка участника на мероприятие"""
    participant = models.ForeignKey(
        Participant, 
        on_delete=models.CASCADE, 
        related_name='event_registrations'
    )
    event = models.ForeignKey(
        Event, 
        on_delete=models.CASCADE, 
        related_name='registrations'
    )
    registered_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('participant', 'event')
        verbose_name = 'Event Registration'
        verbose_name_plural = 'Event Registrations'
        indexes = [
            models.Index(fields=['participant']),
            models.Index(fields=['event']),
            models.Index(fields=['registered_at']),
        ]
    
    def clean(self):
        # Валидация: участник и мероприятие должны принадлежать одному eventum
        if self.participant_id and self.event_id:
            if self.participant.eventum != self.event.eventum:
                raise ValidationError(
                    f"Участник {self.participant.name} и мероприятие {self.event.name} "
                    f"должны принадлежать одному мероприятию (eventum)"
                )
        
        # Валидация: можно подавать заявки только на мероприятия с типом "По записи"
        if self.event_id and self.event.participant_type != Event.ParticipantType.REGISTRATION:
            raise ValidationError(
                f"Подача заявки на мероприятие '{self.event.name}' возможна только для мероприятий "
                f"с типом участников 'По записи'"
            )
        
        # Примечание: лимит участников (max_participants) используется только для отображения
        # и распределения мест, но не блокирует подачу заявок
    
    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.participant.name} → {self.event.name}"


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


@receiver(m2m_changed, sender=Event.tags.through)
def validate_event_tags(sender, instance, action, pk_set, **kwargs):
    """Проверяет, что мероприятие с типом 'не по записи' не добавляется к тегам с волнами"""
    if action in ['pre_add']:
        # Проверяем только если мероприятие имеет тип "не по записи"
        if instance.participant_type != Event.ParticipantType.REGISTRATION:
            tags_with_waves = []
            # Получаем теги, которые будут добавлены
            for tag_id in pk_set:
                tag = EventTag.objects.get(id=tag_id)
                if EventWave.objects.filter(tag=tag).exists():
                    tags_with_waves.append(tag.name)
            
            if tags_with_waves:
                raise ValidationError(
                    f"Нельзя добавить мероприятие с типом участников '{instance.get_participant_type_display()}' "
                    f"к тегам, связанным с волнами регистрации: {', '.join(tags_with_waves)}. "
                    f"Мероприятия в волнах должны иметь тип участников 'По записи'"
                )
