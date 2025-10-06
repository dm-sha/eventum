from rest_framework import serializers
from rest_framework.relations import MANY_RELATION_KWARGS
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.utils.text import slugify
from datetime import datetime
from transliterate import translit
from .models import (
    Eventum, Participant, ParticipantGroup,
    GroupTag, Event, EventTag, UserProfile, UserRole, Location, EventWave, EventRegistration
)


class LocalDateTimeField(serializers.DateTimeField):
    """Простое поле для работы с локальным временем без таймзон"""
    
    def to_internal_value(self, data):
        """Парсит время как есть, без конвертации таймзон"""
        if not data:
            return None
        try:
            return datetime.fromisoformat(data)
        except (ValueError, TypeError) as e:
            raise serializers.ValidationError(f"Неверный формат времени: {data}")
    
    def to_representation(self, value):
        """Возвращает время как есть"""
        if not value:
            return None
        return value.isoformat()


class BulkManyRelatedField(serializers.ManyRelatedField):
    """Many-related field that resolves all primary keys in a single query."""

    def __init__(self, *args, select_related=(), prefetch_related=(), **kwargs):
        self.bulk_select_related = tuple(select_related)
        self.bulk_prefetch_related = tuple(prefetch_related)
        super().__init__(*args, **kwargs)

    def to_internal_value(self, data):
        if isinstance(data, str) or not hasattr(data, "__iter__"):
            self.fail("not_a_list", input_type=type(data).__name__)

        items = list(data)
        if not self.allow_empty and len(items) == 0:
            self.fail("empty")

        if not items:
            return []

        child = self.child_relation
        pk_field = getattr(child, "pk_field", None)
        if pk_field is None:
            # Fall back to the default implementation for custom relations.
            return super().to_internal_value(items)

        validated_ids = []
        for item in items:
            try:
                validated_ids.append(pk_field.to_internal_value(item))
            except serializers.ValidationError:
                raise
            except (TypeError, ValueError):
                child.fail("incorrect_type", data_type=type(item).__name__)

        queryset = child.get_queryset()
        if queryset is None:
            raise AssertionError("BulkPrimaryKeyRelatedField requires a queryset.")

        if self.bulk_select_related:
            queryset = queryset.select_related(*self.bulk_select_related)
        if self.bulk_prefetch_related:
            queryset = queryset.prefetch_related(*self.bulk_prefetch_related)

        matched = list(queryset.filter(pk__in=set(validated_ids)))
        objects_by_pk = {obj.pk: obj for obj in matched}

        missing_ids = [pk for pk in validated_ids if pk not in objects_by_pk]
        if missing_ids:
            template = child.default_error_messages.get(
                "does_not_exist",
                'Invalid pk "{pk_value}" - object does not exist.',
            )
            raise serializers.ValidationError(
                template.format(pk_value=", ".join(str(pk) for pk in missing_ids))
            )

        return [objects_by_pk[pk] for pk in validated_ids]


class BulkPrimaryKeyRelatedField(serializers.PrimaryKeyRelatedField):
    """Primary key field that performs bulk resolution for ``many=True`` usage."""

    def __init__(self, *args, select_related=None, prefetch_related=None, **kwargs):
        select_related = () if select_related is None else select_related
        prefetch_related = () if prefetch_related is None else prefetch_related
        if isinstance(select_related, str):
            select_related = (select_related,)
        if isinstance(prefetch_related, str):
            prefetch_related = (prefetch_related,)
        self._bulk_select_related = tuple(select_related)
        self._bulk_prefetch_related = tuple(prefetch_related)
        super().__init__(*args, **kwargs)

    @classmethod
    def many_init(cls, *args, **kwargs):
        child_relation = cls(*args, **kwargs)
        list_kwargs = {"child_relation": child_relation}
        for key in kwargs:
            if key in MANY_RELATION_KWARGS:
                list_kwargs[key] = kwargs[key]

        return BulkManyRelatedField(
            select_related=child_relation._bulk_select_related,
            prefetch_related=child_relation._bulk_prefetch_related,
            **list_kwargs,
        )

class EventumSerializer(serializers.ModelSerializer):
    class Meta:
        model = Eventum
        fields = ['id', 'name', 'slug', 'description', 'image_url', 'registration_open']
        # Убираем slug из read_only_fields, чтобы можно было передавать его при создании
    
    def create(self, validated_data):
        # Создаем eventum
        eventum = super().create(validated_data)
        
        # Назначаем создателя организатором
        user = self.context['request'].user
        UserRole.objects.create(
            user=user,
            eventum=eventum,
            role='organizer'
        )
        
        return eventum

class ParticipantSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField(read_only=True)
    user_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    groups = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = Participant
        fields = ['id', 'name', 'user', 'user_id', 'groups']
    
    def get_user(self, obj):
        """Возвращает информацию о пользователе"""
        if obj.user:
            return {
                'id': obj.user.id,
                'vk_id': obj.user.vk_id,
                'name': obj.user.name,
                'avatar_url': obj.user.avatar_url,
                'email': obj.user.email,
                'date_joined': obj.user.date_joined,
                'last_login': obj.user.last_login
            }
        return None
    
    def get_groups(self, obj):
        """Возвращает группы участника"""
        # Используем prefetch_related для оптимизации
        groups = obj.groups.all()
        return [{
            'id': group.id,
            'name': group.name,
            'slug': group.slug,
            'tags': [
                {'id': tag.id, 'name': tag.name, 'slug': tag.slug} 
                for tag in group.tags.all()
            ]
        } for group in groups]
    
    def create(self, validated_data):
        """Переопределяем create для автоматического заполнения имени из пользователя"""
        user_id = validated_data.pop('user_id', None)
        if user_id:
            try:
                user = UserProfile.objects.get(id=user_id)
                validated_data['user'] = user
                # Не перезаписываем имя, если оно явно передано в запросе
                if 'name' not in validated_data or not validated_data['name']:
                    validated_data['name'] = user.name
            except UserProfile.DoesNotExist:
                raise serializers.ValidationError(f"Пользователь с ID {user_id} не найден")
        
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        """Переопределяем update для обработки пользователя"""
        user_id = validated_data.pop('user_id', 'NOT_PROVIDED')
        
        if user_id != 'NOT_PROVIDED':  # user_id был явно передан в запросе
            if user_id:
                try:
                    user = UserProfile.objects.get(id=user_id)
                    validated_data['user'] = user
                    # Не перезаписываем имя, если оно явно передано в запросе
                    if 'name' not in validated_data:
                        validated_data['name'] = user.name
                except UserProfile.DoesNotExist:
                    raise serializers.ValidationError(f"Пользователь с ID {user_id} не найден")
            else:
                # user_id = null - удаляем связь с пользователем
                validated_data['user'] = None
        
        return super().update(instance, validated_data)

class GroupTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = GroupTag
        fields = ['id', 'name', 'slug']

class ParticipantGroupSerializer(serializers.ModelSerializer):
    participants = BulkPrimaryKeyRelatedField(
        many=True,
        queryset=Participant.objects.all(),
        required=False,
        select_related=("eventum", "user"),
    )
    tags = GroupTagSerializer(many=True, read_only=True)
    tag_ids = BulkPrimaryKeyRelatedField(
        many=True,
        write_only=True,
        source='tags',
        queryset=GroupTag.objects.all(),
        required=False,
        select_related="eventum",
    )
    
    def to_representation(self, instance):
        """Переопределяем для оптимизации запросов к тегам"""
        data = super().to_representation(instance)
        
        # Если теги уже загружены через prefetch_related, используем их
        if hasattr(instance, '_prefetched_objects_cache') and 'tags' in instance._prefetched_objects_cache:
            data['tags'] = GroupTagSerializer(instance.tags.all(), many=True).data
        
        return data

    class Meta:
        model = ParticipantGroup
        fields = ['id', 'name', 'slug', 'participants', 'tags', 'tag_ids']

    def validate_tag_ids(self, value):
        """Валидация тегов группы с использованием ID."""
        if not value:
            return value

        eventum = self.context.get('eventum')
        if not eventum:
            return value

        eventum_id = getattr(eventum, 'id', eventum)
        invalid_tags = [tag for tag in value if tag.eventum_id != eventum_id]
        if invalid_tags:
            invalid_names = [tag.name for tag in invalid_tags]
            raise serializers.ValidationError(
                f"Теги {', '.join(invalid_names)} принадлежат другому мероприятию"
            )

        return value

    def validate_participants(self, value):
        """Проверяем, что все участники принадлежат тому же eventum"""
        if not value:
            return value

        # Получаем eventum из контекста
        eventum = self.context.get('eventum')
        if not eventum:
            return value

        # Проверяем, что все участники принадлежат тому же eventum
        eventum_id = getattr(eventum, 'id', eventum)
        invalid_participants = [p for p in value if p.eventum_id != eventum_id]
        if invalid_participants:
            invalid_names = [p.name for p in invalid_participants]
            raise serializers.ValidationError(
                f"Участники {', '.join(invalid_names)} принадлежат другому мероприятию"
            )

        return value
    
    def create(self, validated_data):
        """Переопределяем create для правильной обработки ManyToMany полей"""
        # Извлекаем ManyToMany поля из validated_data
        participants_data = validated_data.pop('participants', [])
        tags_data = validated_data.pop('tags', [])
        
        # Создаем объект через конструктор
        instance = ParticipantGroup(**validated_data)
        
        # Сохраняем объект, чтобы вызвать метод save() модели
        instance.save()
        
        # Устанавливаем ManyToMany связи после сохранения объекта
        if participants_data:
            instance.participants.set(participants_data)
        if tags_data:
            instance.tags.set(tags_data)
        
        return instance

class EventTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventTag
        fields = ['id', 'name', 'slug']

class ParticipantGroupBasicSerializer(serializers.ModelSerializer):
    """Упрощенный сериализатор для базовой информации о группах участников"""
    class Meta:
        model = ParticipantGroup
        fields = ['id', 'name', 'slug']

class GroupTagBasicSerializer(serializers.ModelSerializer):
    """Упрощенный сериализатор для базовой информации о тегах групп"""
    class Meta:
        model = GroupTag
        fields = ['id', 'name', 'slug']

class EventBasicInfoSerializer(serializers.ModelSerializer):
    """Максимально оптимизированный сериализатор для событий"""
    registrations_count = serializers.SerializerMethodField()
    participants_count = serializers.SerializerMethodField()
    assigned_participants_count = serializers.SerializerMethodField()
    available_participants = serializers.SerializerMethodField()
    available_without_unassigned_events = serializers.SerializerMethodField()
    can_convert = serializers.SerializerMethodField()
    
    class Meta:
        model = Event
        fields = ['id', 'name', 'participant_type', 'max_participants', 'registrations_count', 'participants_count', 'assigned_participants_count', 'available_participants', 'available_without_unassigned_events', 'can_convert']

    def get_registrations_count(self, obj):
        # Используем предварительно вычисленное значение из annotate
        if hasattr(obj, 'registrations_count'):
            return obj.registrations_count
        # Fallback для случаев, когда annotate не было применено
        return obj.registrations.count()

    def get_participants_count(self, obj):
        # Используем предварительно вычисленное значение из annotate
        if hasattr(obj, 'participants_count'):
            return obj.participants_count
        return 0

    def get_assigned_participants_count(self, obj):
        """Количество участников, реально привязанных к данному мероприятию"""
        # Используем предварительно вычисленное значение из annotate
        if hasattr(obj, 'participants_count'):
            return obj.participants_count
        # Fallback для случаев, когда annotate не было применено
        return obj.participants.count()

    def get_available_participants(self, obj):
        """Количество участников, которые подали заявку и еще не распределены на другие мероприятия волны"""
        registrations_count = self.get_registrations_count(obj)
        
        if registrations_count == 0:
            return 0
        
        # Получаем тег волны для текущего мероприятия
        wave_tag = None
        for tag in obj.tags.all():
            if hasattr(tag, 'event_wave') and tag.event_wave:
                wave_tag = tag
                break
        
        if not wave_tag:
            # Если нет волны, все участники доступны
            return registrations_count
        
        # Получаем ID всех участников, уже записанных на мероприятия волны с типом MANUAL
        assigned_participant_ids = set()
        for event in wave_tag.events.all():
            if event.participant_type == Event.ParticipantType.MANUAL:
                assigned_participant_ids.update(
                    participant.id for participant in event.participants.all()
                )
        
        # Получаем ID участников текущего события
        current_event_participant_ids = set(
            reg.participant_id for reg in obj.registrations.all()
        )
        
        # Подсчитываем доступных участников
        available_count = len(current_event_participant_ids - assigned_participant_ids)
        return available_count

    def get_available_without_unassigned_events(self, obj):
        """Количество участников, которые подали заявку, не попали на другие мероприятия волны 
        И не имеют заявок на мероприятия, где еще не было распределения (0 привязанных участников)"""
        registrations_count = self.get_registrations_count(obj)
        
        if registrations_count == 0:
            return 0
        
        # Получаем тег волны для текущего мероприятия
        wave_tag = None
        for tag in obj.tags.all():
            if hasattr(tag, 'event_wave') and tag.event_wave:
                wave_tag = tag
                break
        
        if not wave_tag:
            # Если нет волны, все участники доступны
            return registrations_count
        
        # Получаем ID всех участников, уже записанных на мероприятия волны с типом MANUAL
        assigned_participant_ids = set()
        participants_with_unassigned_registrations = set()
        
        for event in wave_tag.events.all():
            if event.participant_type == Event.ParticipantType.MANUAL:
                assigned_participant_ids.update(
                    participant.id for participant in event.participants.all()
                )
            elif (event.participant_type == Event.ParticipantType.REGISTRATION and 
                  event.id != obj.id and 
                  len(event.participants.all()) == 0):
                participants_with_unassigned_registrations.update(
                    reg.participant_id for reg in event.registrations.all()
                )
        
        # Получаем ID участников текущего события
        current_event_participant_ids = set(
            reg.participant_id for reg in obj.registrations.all()
        )
        
        # Исключаем участников, которые уже распределены на другие мероприятия волны
        # И участников, которые имеют заявки на нераспределенные мероприятия
        excluded_participants = assigned_participant_ids | participants_with_unassigned_registrations
        available_count = len(current_event_participant_ids - excluded_participants)
        
        return available_count

    def get_can_convert(self, obj):
        """Можно ли конвертировать регистрации для этого мероприятия"""
        available_count = self.get_available_participants(obj)
        registrations_count = self.get_registrations_count(obj)
        
        return (
            registrations_count > 0 and
            available_count > 0 and
            (obj.max_participants is None or available_count <= obj.max_participants)
        )

class EventWithRegistrationInfoSerializer(serializers.ModelSerializer):
    registrations_count = serializers.SerializerMethodField()
    available_participants = serializers.SerializerMethodField()
    already_assigned_count = serializers.SerializerMethodField()
    assigned_participants_count = serializers.SerializerMethodField()
    available_without_unassigned_events = serializers.SerializerMethodField()
    can_convert = serializers.SerializerMethodField()
    can_convert_normal = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = ['id', 'name', 'participant_type', 'max_participants', 'registrations_count', 'available_participants', 'already_assigned_count', 'assigned_participants_count', 'available_without_unassigned_events', 'can_convert', 'can_convert_normal']
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Кэш для вычислений
        self._wave_data_cache = {}

    def get_registrations_count(self, obj):
        # Используем предварительно вычисленное значение из annotate
        if hasattr(obj, 'registrations_count'):
            return obj.registrations_count
        # Fallback для случаев, когда annotate не было применено
        return obj.registrations.count()
    
    def _get_wave_data(self, obj):
        """Получает данные волны с кэшированием"""
        cache_key = f"wave_data_{obj.id}"
        if cache_key not in self._wave_data_cache:
            # Получаем тег волны для текущего мероприятия
            wave_tag = None
            for tag in obj.tags.all():
                if hasattr(tag, 'event_wave') and tag.event_wave:
                    wave_tag = tag
                    break
            
            if not wave_tag:
                self._wave_data_cache[cache_key] = {
                    'wave_tag': None,
                    'assigned_participant_ids': set(),
                    'participants_with_unassigned_registrations': set()
                }
            else:
                # Получаем ID всех участников, уже записанных на мероприятия волны с типом MANUAL
                assigned_participant_ids = set()
                participants_with_unassigned_registrations = set()
                
                for event in wave_tag.events.all():
                    if event.participant_type == Event.ParticipantType.MANUAL:
                        assigned_participant_ids.update(
                            participant.id for participant in event.participants.all()
                        )
                    elif (event.participant_type == Event.ParticipantType.REGISTRATION and 
                          event.id != obj.id and 
                          len(event.participants.all()) == 0):
                        participants_with_unassigned_registrations.update(
                            reg.participant_id for reg in event.registrations.all()
                        )
                
                self._wave_data_cache[cache_key] = {
                    'wave_tag': wave_tag,
                    'assigned_participant_ids': assigned_participant_ids,
                    'participants_with_unassigned_registrations': participants_with_unassigned_registrations
                }
        
        return self._wave_data_cache[cache_key]

    def get_available_participants(self, obj):
        """Количество участников, которые подали заявку и еще не распределены на другие мероприятия волны"""
        # Используем предварительно загруженные регистрации
        registrations = obj.registrations.all()
        
        if not registrations:
            return 0
        
        wave_data = self._get_wave_data(obj)
        
        if not wave_data['wave_tag']:
            # Если нет волны, все участники доступны
            return len(registrations)
        
        # Подсчитываем доступных участников
        registration_participant_ids = set(reg.participant_id for reg in registrations)
        available_count = len(registration_participant_ids - wave_data['assigned_participant_ids'])
        
        return available_count
    
    def get_already_assigned_count(self, obj):
        """Количество участников, которые подали заявку, но уже распределены на другие мероприятия волны"""
        registrations_count = self.get_registrations_count(obj)
        available_count = self.get_available_participants(obj)
        return registrations_count - available_count
    
    def get_assigned_participants_count(self, obj):
        """Количество участников, реально привязанных к данному мероприятию"""
        # Используем предварительно вычисленное значение из annotate
        if hasattr(obj, 'participants_count'):
            return obj.participants_count
        # Fallback для случаев, когда annotate не было применено
        return obj.participants.count()
    
    def get_available_without_unassigned_events(self, obj):
        """Количество участников, которые подали заявку, не попали на другие мероприятия волны 
        И не имеют заявок на мероприятия, где еще не было распределения (0 привязанных участников)"""
        # Используем предварительно загруженные регистрации
        registrations = obj.registrations.all()
        
        if not registrations:
            return 0
        
        wave_data = self._get_wave_data(obj)
        
        if not wave_data['wave_tag']:
            # Если нет волны, все участники доступны
            return len(registrations)
        
        # Подсчитываем доступных участников
        registration_participant_ids = set(reg.participant_id for reg in registrations)
        
        # Исключаем участников, которые уже распределены на другие мероприятия волны
        # И участников, которые имеют заявки на нераспределенные мероприятия
        excluded_participants = (wave_data['assigned_participant_ids'] | 
                                wave_data['participants_with_unassigned_registrations'])
        available_count = len(registration_participant_ids - excluded_participants)
        
        return available_count
    
    def get_can_convert(self, obj):
        """Можно ли конвертировать регистрации для этого мероприятия"""
        available_count = self.get_available_participants(obj)
        
        # Показываем кнопки если есть заявки, независимо от типа мероприятия
        return (
            self.get_registrations_count(obj) > 0 and
            available_count > 0 and
            (obj.max_participants is None or available_count <= obj.max_participants)
        )
    
    def get_can_convert_normal(self, obj):
        """Можно ли делать обычную конвертацию (только для мероприятий типа registration)"""
        available_count = self.get_available_participants(obj)
        
        return (
            obj.participant_type == Event.ParticipantType.REGISTRATION and
            self.get_registrations_count(obj) > 0 and
            available_count > 0 and
            (obj.max_participants is None or available_count <= obj.max_participants)
        )

class EventWaveSerializer(serializers.ModelSerializer):
    tag = EventTagSerializer(read_only=True)
    tag_id = serializers.PrimaryKeyRelatedField(
        write_only=True, source='tag', queryset=EventTag.objects.all()
    )
    events = serializers.SerializerMethodField(read_only=True)
    
    # Кэш для групп и тегов групп
    _groups_cache = {}
    _group_tags_cache = {}
    
    # Whitelist поля - используем упрощенные сериализаторы
    whitelist_groups = ParticipantGroupBasicSerializer(many=True, read_only=True)
    whitelist_group_ids = BulkPrimaryKeyRelatedField(
        many=True,
        write_only=True,
        source='whitelist_groups',
        queryset=ParticipantGroup.objects.all(),
        required=False,
        allow_empty=True,
        select_related="eventum",
    )
    whitelist_group_tags = GroupTagBasicSerializer(many=True, read_only=True)
    whitelist_group_tag_ids = BulkPrimaryKeyRelatedField(
        many=True,
        write_only=True,
        source='whitelist_group_tags',
        queryset=GroupTag.objects.all(),
        required=False,
        allow_empty=True,
        select_related="eventum",
    )
    
    # Blacklist поля - используем упрощенные сериализаторы
    blacklist_groups = ParticipantGroupBasicSerializer(many=True, read_only=True)
    blacklist_group_ids = BulkPrimaryKeyRelatedField(
        many=True,
        write_only=True,
        source='blacklist_groups',
        queryset=ParticipantGroup.objects.all(),
        required=False,
        allow_empty=True,
        select_related="eventum",
    )
    blacklist_group_tags = GroupTagBasicSerializer(many=True, read_only=True)
    blacklist_group_tag_ids = BulkPrimaryKeyRelatedField(
        many=True,
        write_only=True,
        source='blacklist_group_tags',
        queryset=GroupTag.objects.all(),
        required=False,
        allow_empty=True,
        select_related="eventum",
    )

    class Meta:
        model = EventWave
        fields = [
            'id', 'name', 'tag', 'tag_id', 'events',
            'whitelist_groups', 'whitelist_group_ids', 
            'whitelist_group_tags', 'whitelist_group_tag_ids',
            'blacklist_groups', 'blacklist_group_ids',
            'blacklist_group_tags', 'blacklist_group_tag_ids'
        ]

    def get_events(self, obj):
        # Используем предварительно загруженные события из prefetch_related
        events = obj.tag.events.all()
        # Используем упрощенный сериализатор для лучшей производительности
        return EventBasicInfoSerializer(events, many=True).data
    
    @classmethod
    def get_cached_groups(cls, eventum_id):
        """Получает группы из кэша или загружает их"""
        cache_key = f"groups_{eventum_id}"
        if cache_key not in cls._groups_cache:
            from app.models import ParticipantGroup
            cls._groups_cache[cache_key] = list(
                ParticipantGroup.objects.filter(eventum_id=eventum_id).values('id', 'name', 'slug')
            )
        return cls._groups_cache[cache_key]
    
    @classmethod
    def get_cached_group_tags(cls, eventum_id):
        """Получает теги групп из кэша или загружает их"""
        cache_key = f"group_tags_{eventum_id}"
        if cache_key not in cls._group_tags_cache:
            from app.models import GroupTag
            cls._group_tags_cache[cache_key] = list(
                GroupTag.objects.filter(eventum_id=eventum_id).values('id', 'name', 'slug')
            )
        return cls._group_tags_cache[cache_key]
    
    def to_representation(self, instance):
        """Переопределяем для использования кэшированных данных"""
        data = super().to_representation(instance)
        
        # Используем кэшированные данные для групп и тегов групп
        eventum_id = instance.eventum_id
        
        # Заменяем ВСЕ группы на кэшированные данные (даже если они пустые)
        cached_groups = self.get_cached_groups(eventum_id)
        
        if 'whitelist_groups' in data:
            if data['whitelist_groups']:
                group_ids = [group['id'] for group in data['whitelist_groups']]
                data['whitelist_groups'] = [group for group in cached_groups if group['id'] in group_ids]
            else:
                data['whitelist_groups'] = []
        
        if 'blacklist_groups' in data:
            if data['blacklist_groups']:
                group_ids = [group['id'] for group in data['blacklist_groups']]
                data['blacklist_groups'] = [group for group in cached_groups if group['id'] in group_ids]
            else:
                data['blacklist_groups'] = []
        
        # Заменяем ВСЕ теги групп на кэшированные данные
        cached_group_tags = self.get_cached_group_tags(eventum_id)
        
        if 'whitelist_group_tags' in data:
            if data['whitelist_group_tags']:
                tag_ids = [tag['id'] for tag in data['whitelist_group_tags']]
                data['whitelist_group_tags'] = [tag for tag in cached_group_tags if tag['id'] in tag_ids]
            else:
                data['whitelist_group_tags'] = []
        
        if 'blacklist_group_tags' in data:
            if data['blacklist_group_tags']:
                tag_ids = [tag['id'] for tag in data['blacklist_group_tags']]
                data['blacklist_group_tags'] = [tag for tag in cached_group_tags if tag['id'] in tag_ids]
            else:
                data['blacklist_group_tags'] = []
        
        return data

    def validate_whitelist_group_ids(self, value):
        """Валидация whitelist_group_ids - группы должны принадлежать тому же eventum"""
        if not value:
            return value
        
        eventum = self.context.get('eventum')
        if eventum:
            eventum_id = getattr(eventum, 'id', eventum)
            invalid_groups = [group for group in value if group.eventum_id != eventum_id]
            if invalid_groups:
                names = ', '.join(group.name for group in invalid_groups)
                raise serializers.ValidationError(
                    f"Группы {names} не принадлежат данному eventum"
                )
        return value

    def validate_whitelist_group_tag_ids(self, value):
        """Валидация whitelist_group_tag_ids - теги групп должны принадлежать тому же eventum"""
        if not value:
            return value
        
        eventum = self.context.get('eventum')
        if eventum:
            eventum_id = getattr(eventum, 'id', eventum)
            invalid_tags = [tag for tag in value if tag.eventum_id != eventum_id]
            if invalid_tags:
                names = ', '.join(tag.name for tag in invalid_tags)
                raise serializers.ValidationError(
                    f"Теги групп {names} не принадлежат данному eventum"
                )
        return value

    def validate_blacklist_group_ids(self, value):
        """Валидация blacklist_group_ids - группы должны принадлежать тому же eventum"""
        if not value:
            return value
        
        eventum = self.context.get('eventum')
        if eventum:
            eventum_id = getattr(eventum, 'id', eventum)
            invalid_groups = [group for group in value if group.eventum_id != eventum_id]
            if invalid_groups:
                names = ', '.join(group.name for group in invalid_groups)
                raise serializers.ValidationError(
                    f"Группы {names} не принадлежат данному eventum"
                )
        return value

    def validate_blacklist_group_tag_ids(self, value):
        """Валидация blacklist_group_tag_ids - теги групп должны принадлежать тому же eventum"""
        if not value:
            return value
        
        eventum = self.context.get('eventum')
        if eventum:
            eventum_id = getattr(eventum, 'id', eventum)
            invalid_tags = [tag for tag in value if tag.eventum_id != eventum_id]
            if invalid_tags:
                names = ', '.join(tag.name for tag in invalid_tags)
                raise serializers.ValidationError(
                    f"Теги групп {names} не принадлежат данному eventum"
                )
        return value

    def validate(self, attrs):
        # Запретить изменение тега у существующей волны
        instance = getattr(self, 'instance', None)
        if instance is not None and 'tag' in attrs and attrs['tag'] != instance.tag:
            raise serializers.ValidationError({'tag_id': 'Нельзя изменить тег волны после создания'})
        return super().validate(attrs)

class LocationSerializer(serializers.ModelSerializer):
    parent = serializers.SerializerMethodField(read_only=True)
    parent_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    children = serializers.SerializerMethodField(read_only=True)
    full_path = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = Location
        fields = [
            'id', 'name', 'slug', 'kind', 'address', 'floor', 'notes',
            'parent', 'parent_id', 'children', 'full_path'
        ]
        read_only_fields = ['slug']
    
    def get_parent(self, obj):
        """Возвращает информацию о родительской локации"""
        if obj.parent:
            return {
                'id': obj.parent.id,
                'name': obj.parent.name,
                'slug': obj.parent.slug,
                'kind': obj.parent.kind
            }
        return None
    
    def get_children(self, obj):
        """Возвращает список дочерних локаций"""
        children_map = self.context.get('children_map') if hasattr(self, 'context') else None

        if children_map is not None:
            children = children_map.get(obj.id, [])
        else:
            children = list(obj.children.all())

        if not children:
            return []

        context = getattr(self, 'context', {})
        serializer = self.__class__(children, many=True, context=context)
        return serializer.data
    
    def get_full_path(self, obj):
        """Возвращает полный путь локации от корня до текущей локации"""
        path = []
        current = obj
        
        # Собираем путь от текущей локации до корня
        while current:
            path.insert(0, current.name)
            current = current.parent
        
        return ', '.join(path)
    
    
    def validate_parent_id(self, value):
        """Проверяем, что родительская локация принадлежит тому же eventum"""
        if value is None:
            return value
            
        # Получаем eventum из контекста
        eventum = self.context.get('eventum')
        if not eventum:
            return value
            
        try:
            parent = Location.objects.get(id=value)
            if parent.eventum != eventum:
                raise serializers.ValidationError(
                    "Родительская локация должна принадлежать тому же мероприятию"
                )
        except Location.DoesNotExist:
            raise serializers.ValidationError(f"Родительская локация с ID {value} не найдена")
        
        return value
    
    def create(self, validated_data):
        """Переопределяем create для обработки parent_id и генерации уникального slug"""
        parent_id = validated_data.pop('parent_id', None)
        if parent_id:
            try:
                parent = Location.objects.get(id=parent_id)
                validated_data['parent'] = parent
            except Location.DoesNotExist:
                raise serializers.ValidationError(f"Родительская локация с ID {parent_id} не найдена")
        
        # Генерируем уникальный slug
        eventum = validated_data.get('eventum')
        name = validated_data.get('name')
        if name and eventum:
            transliterated = translit(name, 'ru', reversed=True)
            base_slug = slugify(transliterated)
            
            slug = base_slug
            counter = 1
            while Location.objects.filter(eventum=eventum, slug=slug).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            validated_data['slug'] = slug
        
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        """Переопределяем update для обработки parent_id и генерации уникального slug"""
        parent_id = validated_data.pop('parent_id', None)
        if parent_id:
            try:
                parent = Location.objects.get(id=parent_id)
                validated_data['parent'] = parent
            except Location.DoesNotExist:
                raise serializers.ValidationError(f"Родительская локация с ID {parent_id} не найдена")
        elif parent_id is None:
            # Если parent_id явно передан как None, убираем родителя
            validated_data['parent'] = None
        
        # Генерируем уникальный slug если изменилось название
        if 'name' in validated_data and validated_data['name'] != instance.name:
            eventum = instance.eventum
            name = validated_data['name']
            transliterated = translit(name, 'ru', reversed=True)
            base_slug = slugify(transliterated)
            
            slug = base_slug
            counter = 1
            while Location.objects.filter(eventum=eventum, slug=slug).exclude(id=instance.id).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            validated_data['slug'] = slug
        
        return super().update(instance, validated_data)

class EventSerializer(serializers.ModelSerializer):
    participants = BulkPrimaryKeyRelatedField(
        many=True,
        queryset=Participant.objects.all(),
        required=False,
        allow_empty=True,
        select_related=("eventum", "user"),
    )
    groups = BulkPrimaryKeyRelatedField(
        many=True,
        queryset=ParticipantGroup.objects.all(),
        required=False,
        allow_empty=True,
        select_related="eventum",
    )
    tags = EventTagSerializer(many=True, read_only=True)
    tag_ids = BulkPrimaryKeyRelatedField(
        many=True,
        write_only=True,
        source='tags',
        queryset=EventTag.objects.all(),
        required=False,
        allow_empty=True,
        select_related="eventum",
    )
    group_tags = GroupTagSerializer(many=True, read_only=True)
    group_tag_ids = BulkPrimaryKeyRelatedField(
        many=True,
        write_only=True,
        source='group_tags',
        queryset=GroupTag.objects.all(),
        required=False,
        allow_empty=True,
        select_related="eventum",
    )
    locations = LocationSerializer(many=True, read_only=True)
    location_ids = BulkPrimaryKeyRelatedField(
        many=True,
        write_only=True,
        source='locations',
        queryset=Location.objects.all(),
        required=False,
        allow_empty=True,
        select_related="eventum",
    )
    registrations_count = serializers.SerializerMethodField()
    is_registered = serializers.SerializerMethodField()
    
    # Обычные поля времени - работаем без таймзон
    start_time = serializers.DateTimeField()
    end_time = serializers.DateTimeField()

    class Meta:
        model = Event
        fields = [
            'id', 'name', 'description', 'start_time', 'end_time',
            'participant_type', 'max_participants', 'image_url',
            'participants', 'groups', 'tags', 'tag_ids', 'group_tags', 'group_tag_ids', 
            'locations', 'location_ids', 'registrations_count', 'is_registered'
        ]

    def update(self, instance, validated_data):
        """Переопределяем update для правильной обработки валидации participant_type"""
        # Извлекаем many-to-many поля
        participants = validated_data.pop('participants', None)
        groups = validated_data.pop('groups', None)
        tags = validated_data.pop('tags', None)
        group_tags = validated_data.pop('group_tags', None)
        locations = validated_data.pop('locations', None)
        
        # Обновляем обычные поля
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        # Сохраняем изменения обычных полей
        instance.save()
        
        # Обновляем many-to-many поля
        if participants is not None:
            instance.participants.set(participants)
        if groups is not None:
            instance.groups.set(groups)
        if tags is not None:
            instance.tags.set(tags)
        if group_tags is not None:
            instance.group_tags.set(group_tags)
        if locations is not None:
            instance.locations.set(locations)
        
        return instance

    def get_registrations_count(self, obj):
        """Получить количество записанных участников"""
        # Используем prefetch_related данные если доступны
        if hasattr(obj, '_prefetched_objects_cache') and 'registrations' in obj._prefetched_objects_cache:
            return len(obj._prefetched_objects_cache['registrations'])
        
        from .models import EventRegistration
        return EventRegistration.objects.filter(event=obj).count()

    def get_is_registered(self, obj):
        """Проверить, записан ли текущий пользователь на мероприятие"""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        
        # Используем prefetch_related данные если доступны
        if hasattr(obj, '_prefetched_objects_cache') and 'registrations' in obj._prefetched_objects_cache:
            user_registrations = [
                reg for reg in obj._prefetched_objects_cache['registrations']
                if reg.participant.user_id == request.user.id
            ]
            return len(user_registrations) > 0
        
        from .models import EventRegistration, Participant
        try:
            participant = Participant.objects.get(user=request.user, eventum=obj.eventum)
            return EventRegistration.objects.filter(participant=participant, event=obj).exists()
        except Participant.DoesNotExist:
            return False

    def validate_participants(self, value):
        if not value:
            return value

        eventum = self.context.get('eventum')
        if eventum:
            eventum_id = getattr(eventum, 'id', eventum)
            invalid = [
                participant
                for participant in value
                if participant.eventum_id != eventum_id
            ]
            if invalid:
                names = ', '.join(participant.name for participant in invalid)
                raise serializers.ValidationError(
                    f"Участники {names} принадлежат другому мероприятию"
                )

        return value

    def validate_groups(self, value):
        if not value:
            return value

        eventum = self.context.get('eventum')
        if eventum:
            eventum_id = getattr(eventum, 'id', eventum)
            invalid = [
                group
                for group in value
                if group.eventum_id != eventum_id
            ]
            if invalid:
                names = ', '.join(group.name for group in invalid)
                raise serializers.ValidationError(
                    f"Группы {names} принадлежат другому мероприятию"
                )

        return value

    def validate_group_tag_ids(self, value):
        if not value:
            return value

        eventum = self.context.get('eventum')
        if eventum:
            eventum_id = getattr(eventum, 'id', eventum)
            invalid = [
                group_tag
                for group_tag in value
                if group_tag.eventum_id != eventum_id
            ]
            if invalid:
                names = ', '.join(group_tag.name for group_tag in invalid)
                raise serializers.ValidationError(
                    f"Теги групп {names} принадлежат другому мероприятию"
                )

        return value

    def validate(self, data):
        """Валидация на уровне объекта для проверки participant_type и max_participants"""
        participant_type = data.get('participant_type')
        max_participants = data.get('max_participants')
        
        if participant_type == 'registration':
            if not max_participants or max_participants <= 0:
                raise serializers.ValidationError({
                    'max_participants': 'max_participants must be specified and greater than 0 for registration type events'
                })
        # Удалено: валидация max_participants для типов all и manual
        
        # Check if trying to change participant_type from manual when there are existing connections
        if self.instance and self.instance.pk:
            original_participant_type = self.instance.participant_type
            new_participant_type = participant_type or original_participant_type
            
            # If changing from manual to another type, check for existing connections
            if (original_participant_type == 'manual' and 
                new_participant_type != 'manual'):
                
                # Get new values for related fields from the request data
                new_participants = data.get('participants', [])
                new_groups = data.get('groups', [])
                new_group_tags = data.get('group_tags', [])
                
                # Check if there will be participants after update
                if new_participants:
                    raise serializers.ValidationError({
                        'participant_type': 'Нельзя изменить тип участников с "manual" на другой тип, '
                                          'пока не удалены все связи с участниками'
                    })
                
                # Check if there will be groups after update
                if new_groups:
                    raise serializers.ValidationError({
                        'participant_type': 'Нельзя изменить тип участников с "manual" на другой тип, '
                                          'пока не удалены все связи с группами'
                    })
                
                # Check if there will be group tags after update
                if new_group_tags:
                    raise serializers.ValidationError({
                        'participant_type': 'Нельзя изменить тип участников с "manual" на другой тип, '
                                          'пока не удалены все связи с тегами групп'
                    })
            
            # Проверяем изменение типа участников у мероприятий, связанных с волнами
            if original_participant_type != new_participant_type:
                from .models import EventWave
                # Проверяем, есть ли у этого мероприятия теги, связанные с волнами
                event_waves_with_this_event_tags = EventWave.objects.filter(
                    eventum=self.instance.eventum,
                    tag__in=self.instance.tags.all()
                )
                
                if event_waves_with_this_event_tags.exists():
                    wave_names = list(event_waves_with_this_event_tags.values_list('name', flat=True))
                    original_display = dict(Event.ParticipantType.choices).get(original_participant_type, original_participant_type)
                    new_display = dict(Event.ParticipantType.choices).get(new_participant_type, new_participant_type)
                    raise serializers.ValidationError({
                        'participant_type': f"Нельзя изменить тип участников мероприятия '{self.instance.name}' "
                                          f"с '{original_display}' на '{new_display}', "
                                          f"так как оно связано с волной мероприятий: {', '.join(wave_names)}. "
                                          f"Мероприятия в волне должны иметь тип участников 'По записи'"
                    })
        
        return data

    def validate_location_ids(self, value):
        """Валидация location_ids - локации должны принадлежать тому же eventum"""
        if not value:
            return value
        
        # Получаем eventum из контекста
        eventum = self.context.get('eventum')
        if eventum:
            eventum_id = getattr(eventum, 'id', eventum)
            invalid_locations = [location for location in value if location.eventum_id != eventum_id]
            if invalid_locations:
                names = ', '.join(location.name for location in invalid_locations)
                raise serializers.ValidationError(
                    f"Локации {names} не принадлежат данному eventum"
                )
        
        return value

    def validate_tag_ids(self, value):
        """Валидация tag_ids - теги должны принадлежать тому же eventum"""
        if not value:
            return value

        # Получаем eventum из контекста
        eventum = self.context.get('eventum')
        if eventum:
            eventum_id = getattr(eventum, 'id', eventum)
            invalid_tags = [tag for tag in value if tag.eventum_id != eventum_id]
            if invalid_tags:
                names = ', '.join(tag.name for tag in invalid_tags)
                raise serializers.ValidationError(
                    f"Теги {names} не принадлежат данному eventum"
                )

        # Удалено: проверка что мероприятие с типом "не по записи" не добавляется к тегам с волнами

        return value


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['id', 'vk_id', 'name', 'avatar_url', 'email', 'date_joined', 'last_login']
        read_only_fields = ['id', 'date_joined', 'last_login']


class UserRoleSerializer(serializers.ModelSerializer):
    user = UserProfileSerializer(read_only=True)
    eventum = EventumSerializer(read_only=True)
    
    class Meta:
        model = UserRole
        fields = ['id', 'user', 'eventum', 'role', 'created_at']
        read_only_fields = ['id', 'created_at']


class VKAuthSerializer(serializers.Serializer):
    """Сериализатор для авторизации через VK"""
    code = serializers.CharField()
    state = serializers.CharField(required=False)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Кастомный сериализатор для JWT токенов с дополнительными полями"""
    
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        
        # Добавляем дополнительные поля в токен
        token['vk_id'] = user.vk_id
        token['name'] = user.name
        token['avatar_url'] = user.avatar_url
        
        return token
    
    def validate(self, attrs):
        data = super().validate(attrs)
        
        # Добавляем информацию о пользователе в ответ
        data['user'] = UserProfileSerializer(self.user).data
        
        return data


class EventRegistrationSerializer(serializers.ModelSerializer):
    """Сериализатор для заявок участника на мероприятия"""
    event = EventSerializer(read_only=True)
    registered_at = serializers.DateTimeField(read_only=True)
    
    class Meta:
        model = EventRegistration
        fields = ['id', 'event', 'registered_at']
        read_only_fields = ['id', 'registered_at']
