from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.exceptions import ValidationError
from django.core.cache import cache
from django.db import models
from django.db.models.signals import post_save, m2m_changed, post_delete
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
    schedule_visible = models.BooleanField(
        default=True,
        help_text="Отображать ли вкладку расписания участникам"
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


class ParticipantGroupV2(models.Model):
    """Новая модель групп участников с поддержкой рекурсивных связей"""
    eventum = models.ForeignKey(Eventum, on_delete=models.CASCADE, related_name='participant_groups_v2')
    name = models.CharField(max_length=200)
    is_event_group = models.BooleanField(
        default=False,
        help_text="Если True, группа используется для связи с событиями и не показывается в основном интерфейсе"
    )
    
    class Meta:
        indexes = [
            models.Index(fields=['eventum']),
            models.Index(fields=['is_event_group']),
        ]
        verbose_name = 'Participant Group V2'
        verbose_name_plural = 'Participant Groups V2'
    
    def __str__(self):
        return f"{self.name} ({self.eventum.name})"
    
    def get_participants(self, visited_groups=None, all_participant_ids=None):
        """
        Получает QuerySet участников, которые принадлежат этой группе.
        Работает с prefetch'нутыми данными в памяти, если они доступны.
        Иначе использует запросы к БД и кеширование.
        
        Логика:
        - Если нет ни участников, ни inclusive групп, возвращаются все участники eventum
        - Если есть участники или inclusive группы, применяется логика включений/исключений
        
        Args:
            visited_groups: set ID групп, которые уже обработаны (для предотвращения циклов)
            all_participant_ids: set всех ID участников eventum (для случая, когда нет inclusive связей)
        """
        if visited_groups is None:
            visited_groups = set()
        
        # Предотвращаем циклические ссылки
        if self.id in visited_groups:
            return Participant.objects.none()
        
        visited_groups.add(self.id)
        
        # Проверяем, загружены ли данные через prefetch
        prefetched_cache = getattr(self, '_prefetched_objects_cache', {})
        prefetched_participant_relations = prefetched_cache.get('participant_relations', None)
        prefetched_group_relations = prefetched_cache.get('group_relations', None)
        
        # Если данные prefetch'нуты, работаем в памяти
        if prefetched_participant_relations is not None or prefetched_group_relations is not None:
            participant_ids = self._get_participant_ids_from_prefetched(
                all_participant_ids, visited_groups.copy()
            )
            return Participant.objects.filter(id__in=participant_ids)
        
        # Иначе используем старую логику с запросами к БД
        # Генерируем ключ кеша
        cache_key = f'group_participants_{self.id}_{self.eventum_id}'
        
        # Пытаемся получить из кеша (только если visited_groups пустой, чтобы избежать рекурсивных проблем)
        if len(visited_groups) == 1:  # Это первый уровень вызова
            cached_result = cache.get(cache_key)
            if cached_result is not None:
                # Восстанавливаем QuerySet из закешированных ID
                participant_ids = cached_result
                return Participant.objects.filter(id__in=participant_ids)
        
        # Проверяем, есть ли хотя бы одна inclusive связь с участником или группой
        has_inclusive_participants = self.participant_relations.filter(
            relation_type=ParticipantGroupV2ParticipantRelation.RelationType.INCLUSIVE
        ).exists()
        
        has_inclusive_groups = self.group_relations.filter(
            relation_type=ParticipantGroupV2GroupRelation.RelationType.INCLUSIVE
        ).exists()
        
        # Если нет ни участников, ни inclusive групп, возвращаем всех участников eventum
        if not has_inclusive_participants and not has_inclusive_groups:
            all_participants = Participant.objects.filter(eventum=self.eventum)
            
            # Применяем исключения (exclusive), если они есть
            excluded_participant_ids = set()
            
            # Исключенные участники из прямых связей
            excluded_relations = self.participant_relations.filter(
                relation_type=ParticipantGroupV2ParticipantRelation.RelationType.EXCLUSIVE
            )
            excluded_participant_ids.update(
                rel.participant_id for rel in excluded_relations
            )
            
            # Исключенные участники из групп
            for group_rel in self.group_relations.filter(
                relation_type=ParticipantGroupV2GroupRelation.RelationType.EXCLUSIVE
            ):
                excluded_participant_ids.update(
                    group_rel.target_group.get_participants(visited_groups.copy(), all_participant_ids).values_list('id', flat=True)
                )
            
            if excluded_participant_ids:
                result = all_participants.exclude(id__in=excluded_participant_ids)
            else:
                result = all_participants
        else:
            # Иначе применяем стандартную логику включений/исключений
            included_participant_ids = set()
            excluded_participant_ids = set()
            
            # Обрабатываем прямые связи с участниками
            for rel in self.participant_relations.all():
                if rel.relation_type == ParticipantGroupV2ParticipantRelation.RelationType.INCLUSIVE:
                    included_participant_ids.add(rel.participant_id)
                elif rel.relation_type == ParticipantGroupV2ParticipantRelation.RelationType.EXCLUSIVE:
                    excluded_participant_ids.add(rel.participant_id)
            
            # Обрабатываем связи с группами
            for rel in self.group_relations.all():
                target_participants = rel.target_group.get_participants(visited_groups.copy(), all_participant_ids)
                target_participant_ids = set(target_participants.values_list('id', flat=True))
                
                if rel.relation_type == ParticipantGroupV2GroupRelation.RelationType.INCLUSIVE:
                    included_participant_ids.update(target_participant_ids)
                elif rel.relation_type == ParticipantGroupV2GroupRelation.RelationType.EXCLUSIVE:
                    excluded_participant_ids.update(target_participant_ids)
            
            # Исключаем участников из списка включенных
            included_participant_ids -= excluded_participant_ids
            
            if included_participant_ids:
                result = Participant.objects.filter(id__in=included_participant_ids)
            else:
                result = Participant.objects.none()
        
        # Кешируем результат (только если это не рекурсивный вызов)
        if len(visited_groups) == 1:  # Это первый уровень вызова
            participant_ids = list(result.values_list('id', flat=True))
            cache.set(cache_key, participant_ids, timeout=3600)  # Кеш на 1 час
        
        return result
    
    def _get_participant_ids_from_prefetched(self, all_participant_ids=None, visited_groups=None):
        """
        Вспомогательный метод для получения set ID участников из prefetch'нутых данных.
        Работает полностью в памяти без запросов к БД.
        """
        if visited_groups is None:
            visited_groups = set()
        
        if self.id in visited_groups:
            return set()
        
        visited_groups.add(self.id)
        
        prefetched_cache = getattr(self, '_prefetched_objects_cache', {})
        prefetched_participant_relations = prefetched_cache.get('participant_relations', None)
        prefetched_group_relations = prefetched_cache.get('group_relations', None)
        
        # Используем prefetch'нутые данные (преобразуем в список для итерации)
        participant_relations = list(prefetched_participant_relations) if prefetched_participant_relations is not None else []
        group_relations = list(prefetched_group_relations) if prefetched_group_relations is not None else []
        
        # Проверяем, есть ли хотя бы одна inclusive связь
        has_inclusive_participants = any(
            rel.relation_type == ParticipantGroupV2ParticipantRelation.RelationType.INCLUSIVE
            for rel in participant_relations
        )
        has_inclusive_groups = any(
            rel.relation_type == ParticipantGroupV2GroupRelation.RelationType.INCLUSIVE
            for rel in group_relations
        )
        
        # Если нет ни участников, ни inclusive групп, возвращаем всех участников eventum
        if not has_inclusive_participants and not has_inclusive_groups:
            if all_participant_ids is not None:
                included_ids = set(all_participant_ids)
            else:
                # Fallback: загружаем всех участников eventum
                included_ids = set(Participant.objects.filter(eventum=self.eventum).values_list('id', flat=True))
            
            # Применяем исключения из прямых связей
            excluded_ids = {
                rel.participant_id
                for rel in participant_relations
                if rel.relation_type == ParticipantGroupV2ParticipantRelation.RelationType.EXCLUSIVE
            }
            
            # Применяем исключения из групп (рекурсивно)
            for group_rel in group_relations:
                if group_rel.relation_type == ParticipantGroupV2GroupRelation.RelationType.EXCLUSIVE:
                    target_ids = self._get_participant_ids_from_group(group_rel.target_group, all_participant_ids, visited_groups.copy())
                    excluded_ids.update(target_ids)
            
            return included_ids - excluded_ids
        else:
            # Применяем логику включений/исключений
            included_ids = set()
            excluded_ids = set()
            
            # Обрабатываем прямые связи с участниками
            for rel in participant_relations:
                if rel.relation_type == ParticipantGroupV2ParticipantRelation.RelationType.INCLUSIVE:
                    included_ids.add(rel.participant_id)
                elif rel.relation_type == ParticipantGroupV2ParticipantRelation.RelationType.EXCLUSIVE:
                    excluded_ids.add(rel.participant_id)
            
            # Обрабатываем связи с группами
            for group_rel in group_relations:
                target_ids = self._get_participant_ids_from_group(group_rel.target_group, all_participant_ids, visited_groups.copy())
                
                if group_rel.relation_type == ParticipantGroupV2GroupRelation.RelationType.INCLUSIVE:
                    included_ids.update(target_ids)
                elif group_rel.relation_type == ParticipantGroupV2GroupRelation.RelationType.EXCLUSIVE:
                    excluded_ids.update(target_ids)
            
            # Исключаем участников из списка включенных
            included_ids -= excluded_ids
            
            return included_ids
    
    def get_participants_count(self, all_participant_ids=None):
        """
        Быстрое получение количества участников.
        Использует get_participants() и возвращает количество.
        Работает с prefetch'нутыми данными в памяти, если они доступны.
        Иначе использует кеш или запросы к БД.
        """
        # Проверяем кеш для оптимизации (избегаем создания QuerySet)
        cache_key = f'group_participants_{self.id}_{self.eventum_id}'
        cached_ids = cache.get(cache_key)
        if cached_ids is not None:
            # Используем длину закешированного списка (быстро, без SQL)
            return len(cached_ids)
        
        # Проверяем, загружены ли данные через prefetch для оптимизации
        prefetched_cache = getattr(self, '_prefetched_objects_cache', {})
        prefetched_participant_relations = prefetched_cache.get('participant_relations', None)
        prefetched_group_relations = prefetched_cache.get('group_relations', None)
        
        # Если данные prefetch'нуты, работаем в памяти (избегаем создания QuerySet)
        if prefetched_participant_relations is not None or prefetched_group_relations is not None:
            participant_ids = self._get_participant_ids_from_prefetched(all_participant_ids)
            return len(participant_ids)
        
        # Иначе используем get_participants() и берем count
        return self.get_participants(all_participant_ids=all_participant_ids).count()
    
    def _get_participant_ids_from_group(self, group, all_participant_ids=None, visited_groups=None):
        """
        Вспомогательный метод для получения set ID участников из группы.
        Работает с prefetch'нутыми данными в памяти.
        """
        if visited_groups is None:
            visited_groups = set()
        
        if group.id in visited_groups:
            return set()
        
        visited_groups.add(group.id)
        
        prefetched_cache = getattr(group, '_prefetched_objects_cache', {})
        prefetched_participant_relations = prefetched_cache.get('participant_relations', None)
        prefetched_group_relations = prefetched_cache.get('group_relations', None)
        
        # Если данные не prefetch'нуты, используем fallback
        if prefetched_participant_relations is None and prefetched_group_relations is None:
            return set(group.get_participants().values_list('id', flat=True))
        
        participant_relations = list(prefetched_participant_relations) if prefetched_participant_relations is not None else []
        group_relations = list(prefetched_group_relations) if prefetched_group_relations is not None else []
        
        # Проверяем, есть ли inclusive связи
        has_inclusive_participants = any(
            rel.relation_type == ParticipantGroupV2ParticipantRelation.RelationType.INCLUSIVE
            for rel in participant_relations
        )
        has_inclusive_groups = any(
            rel.relation_type == ParticipantGroupV2GroupRelation.RelationType.INCLUSIVE
            for rel in group_relations
        )
        
        if not has_inclusive_participants and not has_inclusive_groups:
            # Все участники eventum минус исключения
            if all_participant_ids is not None:
                included_ids = set(all_participant_ids)
            else:
                included_ids = set(Participant.objects.filter(eventum=group.eventum).values_list('id', flat=True))
            
            excluded_ids = {
                rel.participant_id
                for rel in participant_relations
                if rel.relation_type == ParticipantGroupV2ParticipantRelation.RelationType.EXCLUSIVE
            }
            
            for group_rel in group_relations:
                if group_rel.relation_type == ParticipantGroupV2GroupRelation.RelationType.EXCLUSIVE:
                    excluded_ids.update(self._get_participant_ids_from_group(group_rel.target_group, all_participant_ids, visited_groups.copy()))
            
            return included_ids - excluded_ids
        else:
            # Логика включений/исключений
            included_ids = {
                rel.participant_id
                for rel in participant_relations
                if rel.relation_type == ParticipantGroupV2ParticipantRelation.RelationType.INCLUSIVE
            }
            excluded_ids = {
                rel.participant_id
                for rel in participant_relations
                if rel.relation_type == ParticipantGroupV2ParticipantRelation.RelationType.EXCLUSIVE
            }
            
            for group_rel in group_relations:
                target_ids = self._get_participant_ids_from_group(group_rel.target_group, all_participant_ids, visited_groups.copy())
                if group_rel.relation_type == ParticipantGroupV2GroupRelation.RelationType.INCLUSIVE:
                    included_ids.update(target_ids)
                elif group_rel.relation_type == ParticipantGroupV2GroupRelation.RelationType.EXCLUSIVE:
                    excluded_ids.update(target_ids)
            
            return included_ids - excluded_ids
    
    def has_participant(self, participant_id):
        """Быстрая проверка наличия участника в группе через кеш"""
        cache_key = f'group_participants_{self.id}_{self.eventum_id}'
        cached_ids = cache.get(cache_key)
        if cached_ids is not None:
            # Быстрая проверка в Python (O(1) для set или O(n) для list)
            # Преобразуем в set для быстрой проверки, если список большой
            if len(cached_ids) > 100:
                cached_ids_set = set(cached_ids)
                return participant_id in cached_ids_set
            return participant_id in cached_ids
        # Fallback к старому методу, если кеша нет
        return self.get_participants().filter(id=participant_id).exists()


class ParticipantGroupV2ParticipantRelation(models.Model):
    """Связь группы V2 с участником"""
    class RelationType(models.TextChoices):
        INCLUSIVE = 'inclusive', 'Включает (участник входит в группу)'
        EXCLUSIVE = 'exclusive', 'Исключает (участник НЕ входит в группу)'
    
    group = models.ForeignKey(
        ParticipantGroupV2, 
        on_delete=models.CASCADE, 
        related_name='participant_relations'
    )
    participant = models.ForeignKey(
        Participant, 
        on_delete=models.CASCADE, 
        related_name='group_v2_relations'
    )
    relation_type = models.CharField(
        max_length=20, 
        choices=RelationType.choices,
        default=RelationType.INCLUSIVE
    )
    
    class Meta:
        unique_together = ('group', 'participant')
        indexes = [
            models.Index(fields=['group']),
            models.Index(fields=['participant']),
        ]
        verbose_name = 'Participant Group V2 Participant Relation'
        verbose_name_plural = 'Participant Group V2 Participant Relations'
    
    def clean(self):
        """Валидация связи группа-участник"""
        # Проверяем, что участник принадлежит тому же eventum
        if self.group.eventum != self.participant.eventum:
            raise ValidationError("Participant must belong to the same eventum as the group")
    
    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
    
    def __str__(self):
        relation_desc = "включает" if self.relation_type == self.RelationType.INCLUSIVE else "исключает"
        return f"{self.group.name} {relation_desc} {self.participant.name}"


class ParticipantGroupV2GroupRelation(models.Model):
    """Связь группы V2 с другой группой"""
    class RelationType(models.TextChoices):
        INCLUSIVE = 'inclusive', 'Включает (целевая группа входит в исходную)'
        EXCLUSIVE = 'exclusive', 'Исключает (целевая группа НЕ входит в исходную)'
    
    group = models.ForeignKey(
        ParticipantGroupV2, 
        on_delete=models.CASCADE, 
        related_name='group_relations'
    )
    target_group = models.ForeignKey(
        ParticipantGroupV2, 
        on_delete=models.CASCADE, 
        related_name='source_relations'
    )
    relation_type = models.CharField(
        max_length=20, 
        choices=RelationType.choices,
        default=RelationType.INCLUSIVE
    )
    
    class Meta:
        unique_together = ('group', 'target_group')
        indexes = [
            models.Index(fields=['group']),
            models.Index(fields=['target_group']),
        ]
        verbose_name = 'Participant Group V2 Group Relation'
        verbose_name_plural = 'Participant Group V2 Group Relations'
    
    def clean(self):
        """Валидация связи группа-группа"""
        # Проверяем, что целевая группа принадлежит тому же eventum
        if self.group.eventum != self.target_group.eventum:
            raise ValidationError("Target group must belong to the same eventum as the source group")
        
        # Проверяем, что группа не ссылается сама на себя
        if self.group.pk and self.target_group.pk and self.group.pk == self.target_group.pk:
            raise ValidationError("Group cannot reference itself")
    
    def save(self, *args, **kwargs):
        self.full_clean()
        
        # Проверка циклов для связей группа-группа
        if self.target_group:
            self._check_for_cycles()
        
        super().save(*args, **kwargs)
    
    def _check_for_cycles(self):
        """Проверяет, не создается ли цикл в связях между группами"""
        if not self.group.pk or not self.target_group.pk:
            return
        
        # Если это обновление существующей связи, пропускаем проверку для той же связи
        if self.pk:
            try:
                old_relation = ParticipantGroupV2GroupRelation.objects.get(pk=self.pk)
                # Если целевая группа не изменилась, пропускаем проверку
                if old_relation.target_group_id == self.target_group_id:
                    return
            except ParticipantGroupV2GroupRelation.DoesNotExist:
                pass
        
        # Проверяем цикл: если целевая группа уже ссылается (прямо или косвенно) на текущую группу
        visited = set()
        to_check = [self.target_group_id]
        
        while to_check:
            current_group_id = to_check.pop(0)
            if current_group_id in visited:
                continue
            visited.add(current_group_id)
            
            # Если мы достигли исходной группы, значит есть цикл
            if current_group_id == self.group_id:
                raise ValidationError(
                    f"Creating this relation would create a cycle. "
                    f"Group '{self.target_group.name}' (or a group it references) "
                    f"already references group '{self.group.name}'"
                )
            
            # Получаем все группы, на которые ссылается текущая группа
            referenced_groups = ParticipantGroupV2GroupRelation.objects.filter(
                group_id=current_group_id
            ).values_list('target_group_id', flat=True)
            
            to_check.extend(referenced_groups)
    
    def __str__(self):
        relation_desc = "включает" if self.relation_type == self.RelationType.INCLUSIVE else "исключает"
        return f"{self.group.name} {relation_desc} {self.target_group.name}"


class ParticipantGroupV2EventRelation(models.Model):
    """Связь группы V2 с событием (участники события = участники группы)"""
    group = models.ForeignKey(
        ParticipantGroupV2, 
        on_delete=models.CASCADE, 
        related_name='event_relations'
    )
    event = models.ForeignKey(
        'Event', 
        on_delete=models.CASCADE, 
        related_name='group_v2_relations'
    )
    
    class Meta:
        unique_together = ('group', 'event')
        indexes = [
            models.Index(fields=['group']),
            models.Index(fields=['event']),
        ]
        verbose_name = 'Participant Group V2 Event Relation'
        verbose_name_plural = 'Participant Group V2 Event Relations'
    
    def clean(self):
        """Валидация связи группа-событие"""
        # Проверяем, что группа и событие принадлежат тому же eventum
        if self.group.eventum != self.event.eventum:
            raise ValidationError("Group and event must belong to the same eventum")
    
    def save(self, *args, **kwargs):
        self.full_clean()
        # Автоматически помечаем группу как event_group при создании связи
        if not self.group.is_event_group:
            self.group.is_event_group = True
            self.group.save(update_fields=['is_event_group'])
        super().save(*args, **kwargs)
    
    def delete(self, *args, **kwargs):
        """При удалении связи проверяем, нужно ли снять флаг is_event_group"""
        group = self.group
        super().delete(*args, **kwargs)
        # Если у группы больше нет связей с событиями, снимаем флаг
        if not group.event_relations.exists():
            group.is_event_group = False
            group.save(update_fields=['is_event_group'])
    
    def __str__(self):
        return f"{self.group.name} → {self.event.name}"


class EventTag(models.Model):
    eventum = models.ForeignKey(Eventum, on_delete=models.CASCADE, related_name='event_tags')
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100, blank=True)

    class Meta:
        unique_together = ('eventum', 'slug')

    def clean(self):
        """Валидация тега мероприятий"""
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
    # Опциональная связь 1:1 с группой V2 (участники события = участники группы)
    event_group_v2 = models.OneToOneField(
        ParticipantGroupV2,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='linked_event',
        help_text="Опциональная связь 1:1 с группой V2"
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
        # Удалено: валидация max_participants для типов all и manual
        
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
                # Удалено: проверка participant_type != REGISTRATION для волн
                
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
            
            # Удалено: проверка что мероприятие с типом "не по записи" не добавляется к тегам с волнами
            
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

        # Валидация: если указана группа V2, она должна принадлежать тому же eventum
        if self.event_group_v2 and self.event_group_v2.eventum_id != self.eventum_id:
            raise ValidationError("Event group V2 must belong to the same eventum as the event")
    
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
    """Волна мероприятий - группа регистраций на мероприятия"""
    eventum = models.ForeignKey(Eventum, on_delete=models.CASCADE, related_name='event_waves')
    name = models.CharField(max_length=200, help_text="Название волны мероприятий")
    registrations = models.ManyToManyField(
        'EventRegistration',
        related_name='waves',
        blank=True,
        help_text="Регистрации на мероприятия, входящие в эту волну"
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
        # Валидация: все регистрации должны принадлежать тому же eventum
        if self.pk:  # Проверяем только для сохраненных объектов
            invalid_registrations = self.registrations.exclude(event__eventum=self.eventum)
            if invalid_registrations.exists():
                invalid_names = list(invalid_registrations.values_list('event__name', flat=True))
                raise ValidationError(
                    f"Регистрации на мероприятия {', '.join(invalid_names)} принадлежат другому eventum"
                )
    
    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.name} ({self.eventum.name})"


class EventRegistration(models.Model):
    """Настройка регистрации на мероприятие (одна регистрация на одно мероприятие)"""
    class RegistrationType(models.TextChoices):
        BUTTON = 'button', 'Запись по кнопке'
        APPLICATION = 'application', 'По заявкам'
    
    event = models.OneToOneField(
        Event,
        on_delete=models.CASCADE,
        related_name='registration',
        help_text="Одно мероприятие может иметь только одну настройку регистрации"
    )
    max_participants = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Максимальное количество участников, которое может попасть на мероприятие через регистрацию"
    )
    allowed_group = models.ForeignKey(
        ParticipantGroupV2,
        on_delete=models.CASCADE,
        related_name='event_registrations',
        null=True,
        blank=True,
        help_text="Группа участников, которым доступна запись на это мероприятие. Если не указана, доступна всем участникам eventum."
    )
    registration_type = models.CharField(
        max_length=20,
        choices=RegistrationType.choices,
        default=RegistrationType.BUTTON,
        help_text="Тип добавления участников: 'button' - сразу попадают в группу, 'application' - сохраняются заявки"
    )
    applicants = models.ManyToManyField(
        Participant,
        related_name='event_applications',
        blank=True,
        help_text="Участники, подавшие заявки (используется при типе 'application')"
    )
    
    class Meta:
        verbose_name = 'Event Registration'
        verbose_name_plural = 'Event Registrations'
        indexes = [
            models.Index(fields=['event']),
            models.Index(fields=['allowed_group']),
            models.Index(fields=['registration_type']),
        ]
    
    def clean(self):
        # Валидация: группа должна принадлежать тому же eventum, что и мероприятие
        if self.allowed_group_id and self.event_id:
            if self.allowed_group.eventum != self.event.eventum:
                raise ValidationError(
                    f"Группа {self.allowed_group.name} и мероприятие {self.event.name} "
                    f"должны принадлежать одному мероприятию (eventum)"
                )
        
        # Валидация: для типа BUTTON должно быть создано event_group_v2 у мероприятия
        if self.registration_type == self.RegistrationType.BUTTON:
            if self.event_id and not self.event.event_group_v2_id:
                raise ValidationError(
                    "Для типа регистрации 'Запись по кнопке' у мероприятия должна быть создана группа event_group_v2"
                )
    
    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"Регистрация на {self.event.name}"
    
    def get_registered_count(self, all_participant_ids=None):
        """
        Получить количество зарегистрированных участников.
        
        Args:
            all_participant_ids: set всех ID участников eventum (для работы с prefetch'нутыми данными)
        """
        if self.registration_type == self.RegistrationType.BUTTON:
            # Для типа button считаем участников в event_group_v2
            if self.event.event_group_v2:
                # Используем оптимизированный метод с кешем и prefetch'нутыми данными
                return self.event.event_group_v2.get_participants_count(all_participant_ids)
            return 0
        else:
            # Для типа application считаем заявки
            # Проверяем prefetch'нутые данные
            prefetched_cache = getattr(self, '_prefetched_objects_cache', {})
            prefetched_applicants = prefetched_cache.get('applicants', None)
            if prefetched_applicants is not None:
                return len(prefetched_applicants)
            return self.applicants.count()
    
    def is_full(self, all_participant_ids=None):
        """
        Проверить, заполнена ли регистрация.
        
        Args:
            all_participant_ids: set всех ID участников eventum (для работы с prefetch'нутыми данными)
        """
        if not self.max_participants:
            return False
        return self.get_registered_count(all_participant_ids) >= self.max_participants


class EventRegistrationApplication(models.Model):
    """Заявка участника на мероприятие (используется при типе регистрации 'application')"""
    registration = models.ForeignKey(
        EventRegistration,
        on_delete=models.CASCADE,
        related_name='applications'
    )
    participant = models.ForeignKey(
        Participant,
        on_delete=models.CASCADE,
        related_name='registration_applications'
    )
    applied_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('registration', 'participant')
        verbose_name = 'Event Registration Application'
        verbose_name_plural = 'Event Registration Applications'
        indexes = [
            models.Index(fields=['registration']),
            models.Index(fields=['participant']),
            models.Index(fields=['applied_at']),
        ]
    
    def clean(self):
        # Валидация: участник и мероприятие должны принадлежать одному eventum
        if self.participant_id and self.registration_id and self.registration.event_id:
            if self.participant.eventum != self.registration.event.eventum:
                raise ValidationError(
                    f"Участник {self.participant.name} и мероприятие {self.registration.event.name} "
                    f"должны принадлежать одному мероприятию (eventum)"
                )
        
        # Валидация: тип регистрации должен быть 'application'
        if self.registration_id and self.registration.registration_type != EventRegistration.RegistrationType.APPLICATION:
            raise ValidationError(
                "Заявки можно создавать только для регистраций с типом 'application'"
            )
        
        # Валидация: участник должен быть в allowed_group (если она указана)
        if self.registration_id and self.registration.allowed_group_id:
            if self.participant_id:
                allowed_participants = self.registration.allowed_group.get_participants()
                if not allowed_participants.filter(id=self.participant_id).exists():
                    raise ValidationError(
                        f"Участник {self.participant.name} не входит в группу, "
                        f"которой разрешена регистрация на это мероприятие"
                    )
        
        # Для типа APPLICATION заявок может быть больше чем max_participants,
        # администратор потом выберет, кого одобрить, поэтому валидация на max_participants не нужна
    
    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.participant.name} → {self.registration.event.name} (заявка)"


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
    """Удалено: проверка что мероприятие с типом 'не по записи' не добавляется к тегам с волнами"""
    pass


# Сигналы для инвалидации кеша групп
def invalidate_group_cache(sender, instance, **kwargs):
    """Инвалидирует кеш для всех групп в eventum при изменении связанных моделей"""
    eventum_id = None
    
    # Определяем eventum_id в зависимости от модели
    if hasattr(instance, 'eventum'):
        eventum_id = instance.eventum_id
    elif hasattr(instance, 'group'):
        eventum_id = instance.group.eventum_id
    elif hasattr(instance, 'target_group'):
        eventum_id = instance.target_group.eventum_id
    elif hasattr(instance, 'participant'):
        eventum_id = instance.participant.eventum_id
    elif hasattr(instance, 'event'):
        eventum_id = instance.event.eventum_id
    
    if eventum_id:
        # Инвалидируем кеш для всех групп в этом eventum
        groups = ParticipantGroupV2.objects.filter(eventum_id=eventum_id)
        for group in groups:
            cache_key = f'group_participants_{group.id}_{eventum_id}'
            cache.delete(cache_key)


# Регистрируем сигналы для всех моделей, которые влияют на состав групп
@receiver(post_save, sender=ParticipantGroupV2)
@receiver(post_delete, sender=ParticipantGroupV2)
@receiver(post_save, sender=ParticipantGroupV2ParticipantRelation)
@receiver(post_delete, sender=ParticipantGroupV2ParticipantRelation)
@receiver(post_save, sender=ParticipantGroupV2GroupRelation)
@receiver(post_delete, sender=ParticipantGroupV2GroupRelation)
@receiver(post_save, sender=ParticipantGroupV2EventRelation)
@receiver(post_delete, sender=ParticipantGroupV2EventRelation)
@receiver(post_save, sender=Participant)
@receiver(post_delete, sender=Participant)
def clear_group_cache(sender, instance, **kwargs):
    """Инвалидирует кеш групп при изменении связанных моделей"""
    invalidate_group_cache(sender, instance, **kwargs)
