from rest_framework import serializers
from rest_framework.relations import MANY_RELATION_KWARGS
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.utils.text import slugify
from datetime import datetime
from transliterate import translit
from .models import (
    Eventum, Participant, ParticipantGroup,
    GroupTag, Event, EventTag, UserProfile, UserRole, Location, EventWave, EventRegistration,
    ParticipantGroupV2, ParticipantGroupV2ParticipantRelation, ParticipantGroupV2GroupRelation,
    ParticipantGroupV2EventRelation
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
        fields = ['id', 'name', 'slug', 'description', 'image_url', 'registration_open', 'schedule_visible']
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


class ParticipantGroupV2ParticipantRelationSerializer(serializers.ModelSerializer):
    """Сериализатор для связи группы V2 с участником"""
    group_id = serializers.IntegerField(write_only=True, required=False)
    participant_id = serializers.IntegerField()
    participant = ParticipantSerializer(read_only=True)
    
    class Meta:
        model = ParticipantGroupV2ParticipantRelation
        fields = [
            'id', 'relation_type', 
            'group_id', 'participant_id', 'participant'
        ]
    
    def to_representation(self, instance):
        """Добавляем participant_id в ответ для чтения"""
        data = super().to_representation(instance)
        # Добавляем participant_id из модели для чтения
        data['participant_id'] = instance.participant_id
        return data
    
    def create(self, validated_data):
        """Создание связи с обработкой group_id и participant_id"""
        group_id = validated_data.pop('group_id', None)
        participant_id = validated_data.pop('participant_id')
        
        if group_id is None:
            raise serializers.ValidationError({
                'group_id': 'group_id is required'
            })
        
        try:
            validated_data['group'] = ParticipantGroupV2.objects.get(id=group_id)
        except ParticipantGroupV2.DoesNotExist:
            raise serializers.ValidationError({
                'group_id': f'Group with ID {group_id} does not exist'
            })
        
        try:
            validated_data['participant'] = Participant.objects.get(id=participant_id)
        except Participant.DoesNotExist:
            raise serializers.ValidationError({
                'participant_id': f'Participant with ID {participant_id} does not exist'
            })
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        """Обновление связи с обработкой group_id и participant_id"""
        group_id = validated_data.pop('group_id', None)
        participant_id = validated_data.pop('participant_id', None)
        
        if group_id is not None:
            try:
                validated_data['group'] = ParticipantGroupV2.objects.get(id=group_id)
            except ParticipantGroupV2.DoesNotExist:
                raise serializers.ValidationError({
                    'group_id': f'Group with ID {group_id} does not exist'
                })
        
        if participant_id is not None:
            try:
                validated_data['participant'] = Participant.objects.get(id=participant_id)
            except Participant.DoesNotExist:
                raise serializers.ValidationError({
                    'participant_id': f'Participant with ID {participant_id} does not exist'
                })
        return super().update(instance, validated_data)


class ParticipantGroupV2GroupRelationSerializer(serializers.ModelSerializer):
    """Сериализатор для связи группы V2 с другой группой"""
    group_id = serializers.IntegerField(write_only=True, required=False)
    target_group_id = serializers.IntegerField()
    target_group = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = ParticipantGroupV2GroupRelation
        fields = [
            'id', 'relation_type', 
            'group_id', 'target_group_id', 'target_group'
        ]
    
    def to_representation(self, instance):
        """Добавляем target_group_id в ответ для чтения"""
        data = super().to_representation(instance)
        # Добавляем target_group_id из модели для чтения
        data['target_group_id'] = instance.target_group_id
        return data
    
    def get_target_group(self, obj):
        """Возвращает информацию о целевой группе"""
        if obj.target_group:
            return {
                'id': obj.target_group.id,
                'name': obj.target_group.name
            }
        return None
    
    def create(self, validated_data):
        """Создание связи с обработкой group_id и target_group_id"""
        group_id = validated_data.pop('group_id', None)
        target_group_id = validated_data.pop('target_group_id')
        
        if group_id is None:
            raise serializers.ValidationError({
                'group_id': 'group_id is required'
            })
        
        try:
            validated_data['group'] = ParticipantGroupV2.objects.get(id=group_id)
        except ParticipantGroupV2.DoesNotExist:
            raise serializers.ValidationError({
                'group_id': f'Group with ID {group_id} does not exist'
            })
        
        try:
            validated_data['target_group'] = ParticipantGroupV2.objects.get(id=target_group_id)
        except ParticipantGroupV2.DoesNotExist:
            raise serializers.ValidationError({
                'target_group_id': f'Target group with ID {target_group_id} does not exist'
            })
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        """Обновление связи с обработкой group_id и target_group_id"""
        group_id = validated_data.pop('group_id', None)
        target_group_id = validated_data.pop('target_group_id', None)
        
        if group_id is not None:
            try:
                validated_data['group'] = ParticipantGroupV2.objects.get(id=group_id)
            except ParticipantGroupV2.DoesNotExist:
                raise serializers.ValidationError({
                    'group_id': f'Group with ID {group_id} does not exist'
                })
        
        if target_group_id is not None:
            try:
                validated_data['target_group'] = ParticipantGroupV2.objects.get(id=target_group_id)
            except ParticipantGroupV2.DoesNotExist:
                raise serializers.ValidationError({
                    'target_group_id': f'Target group with ID {target_group_id} does not exist'
                })
        return super().update(instance, validated_data)


class ParticipantGroupV2EventRelationSerializer(serializers.ModelSerializer):
    """Сериализатор для связи группы V2 с событием"""
    group_id = serializers.IntegerField(source='group.id', read_only=True)
    event_id = serializers.IntegerField(source='event.id', read_only=True)
    # Для записи используем эти же поля, но они будут обработаны в to_internal_value
    event = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = ParticipantGroupV2EventRelation
        fields = [
            'id', 
            'group_id', 'event_id', 'event'
        ]
    
    def to_internal_value(self, data):
        """Обрабатываем group_id и event_id при записи"""
        # Сохраняем оригинальные значения для использования в create/update
        if 'group_id' in data:
            self._group_id = data['group_id']
        if 'event_id' in data:
            self._event_id = data['event_id']
        # Удаляем их из data, так как это не поля модели
        data = data.copy()
        data.pop('group_id', None)
        data.pop('event_id', None)
        return super().to_internal_value(data)
    
    
    def get_event(self, obj):
        """Возвращает информацию о событии"""
        if obj.event:
            return {
                'id': obj.event.id,
                'name': obj.event.name,
                'start_time': obj.event.start_time.isoformat() if obj.event.start_time else None,
                'end_time': obj.event.end_time.isoformat() if obj.event.end_time else None,
            }
        return None
    
    def create(self, validated_data):
        """Создание связи с обработкой group_id и event_id"""
        group_id = getattr(self, '_group_id', None) or self.initial_data.get('group_id')
        event_id = getattr(self, '_event_id', None) or self.initial_data.get('event_id')
        
        if not group_id:
            raise serializers.ValidationError({'group_id': 'group_id is required'})
        if not event_id:
            raise serializers.ValidationError({'event_id': 'event_id is required'})
        
        try:
            validated_data['group'] = ParticipantGroupV2.objects.get(id=group_id)
        except ParticipantGroupV2.DoesNotExist:
            raise serializers.ValidationError({
                'group_id': f'Group with ID {group_id} does not exist'
            })
        
        try:
            validated_data['event'] = Event.objects.get(id=event_id)
        except Event.DoesNotExist:
            raise serializers.ValidationError({
                'event_id': f'Event with ID {event_id} does not exist'
            })
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        """Обновление связи с обработкой group_id и event_id"""
        group_id = getattr(self, '_group_id', None) or self.initial_data.get('group_id')
        event_id = getattr(self, '_event_id', None) or self.initial_data.get('event_id')
        
        if group_id is not None:
            try:
                validated_data['group'] = ParticipantGroupV2.objects.get(id=group_id)
            except ParticipantGroupV2.DoesNotExist:
                raise serializers.ValidationError({
                    'group_id': f'Group with ID {group_id} does not exist'
                })
        
        if event_id is not None:
            try:
                validated_data['event'] = Event.objects.get(id=event_id)
            except Event.DoesNotExist:
                raise serializers.ValidationError({
                    'event_id': f'Event with ID {event_id} does not exist'
                })
        return super().update(instance, validated_data)


class ParticipantGroupV2Serializer(serializers.ModelSerializer):
    """Сериализатор для групп участников V2"""
    participant_relations = ParticipantGroupV2ParticipantRelationSerializer(many=True, required=False)
    group_relations = ParticipantGroupV2GroupRelationSerializer(many=True, required=False)
    
    class Meta:
        model = ParticipantGroupV2
        fields = ['id', 'name', 'is_event_group', 'participant_relations', 'group_relations']
    
    def create(self, validated_data):
        """Создание группы с обработкой вложенных связей"""
        participant_relations_data = validated_data.pop('participant_relations', [])
        group_relations_data = validated_data.pop('group_relations', [])
        eventum = self.context.get('eventum')
        
        if eventum:
            validated_data['eventum'] = eventum
        
        # Создаем группу
        group = super().create(validated_data)
        
        # Создаем связи с участниками
        for relation_data in participant_relations_data:
            relation_data['group_id'] = group.id
            serializer = ParticipantGroupV2ParticipantRelationSerializer(data=relation_data, context=self.context)
            serializer.is_valid(raise_exception=True)
            serializer.save()
        
        # Создаем связи с группами
        for relation_data in group_relations_data:
            relation_data['group_id'] = group.id
            serializer = ParticipantGroupV2GroupRelationSerializer(data=relation_data, context=self.context)
            serializer.is_valid(raise_exception=True)
            serializer.save()
        
        return group
    
    def update(self, instance, validated_data):
        """Обновление группы с обработкой вложенных связей"""
        participant_relations_data = validated_data.pop('participant_relations', None)
        group_relations_data = validated_data.pop('group_relations', None)
        
        # Обновляем основные поля группы
        instance = super().update(instance, validated_data)
        
        # Обновляем связи с участниками, если они предоставлены
        if participant_relations_data is not None:
            # Удаляем существующие связи
            instance.participant_relations.all().delete()
            # Создаем новые связи
            for relation_data in participant_relations_data:
                relation_data['group_id'] = instance.id
                serializer = ParticipantGroupV2ParticipantRelationSerializer(data=relation_data, context=self.context)
                serializer.is_valid(raise_exception=True)
                serializer.save()
        
        # Обновляем связи с группами, если они предоставлены
        if group_relations_data is not None:
            # Удаляем существующие связи
            instance.group_relations.all().delete()
            # Создаем новые связи
            for relation_data in group_relations_data:
                relation_data['group_id'] = instance.id
                serializer = ParticipantGroupV2GroupRelationSerializer(data=relation_data, context=self.context)
                serializer.is_valid(raise_exception=True)
                serializer.save()
        
        return instance
    
    def to_representation(self, instance):
        """Переопределяем для оптимизации запросов к связям"""
        data = super().to_representation(instance)
        
        # Если связи уже загружены через prefetch_related, используем их
        # Используем list() для гарантии свежих данных и конвертации в список
        if hasattr(instance, '_prefetched_objects_cache'):
            if 'participant_relations' in instance._prefetched_objects_cache:
                # Получаем prefetch'нутые данные напрямую из кэша и сортируем по id
                prefetched_relations = list(instance._prefetched_objects_cache['participant_relations'])
                prefetched_relations.sort(key=lambda x: x.id)
                data['participant_relations'] = ParticipantGroupV2ParticipantRelationSerializer(
                    prefetched_relations, many=True
                ).data
            if 'group_relations' in instance._prefetched_objects_cache:
                # Получаем prefetch'нутые данные напрямую из кэша и сортируем по id
                prefetched_group_relations = list(instance._prefetched_objects_cache['group_relations'])
                prefetched_group_relations.sort(key=lambda x: x.id)
                data['group_relations'] = ParticipantGroupV2GroupRelationSerializer(
                    prefetched_group_relations, many=True
                ).data
        
        return data


class GroupTagBasicSerializer(serializers.ModelSerializer):
    """Упрощенный сериализатор для базовой информации о тегах групп"""
    class Meta:
        model = GroupTag
        fields = ['id', 'name', 'slug']

class BaseEventSerializer(serializers.ModelSerializer):
    """Базовый сериализатор для событий с общей логикой"""
    registrations_count = serializers.SerializerMethodField()
    participants_count = serializers.SerializerMethodField()
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Кэш для вычислений волны
        self._wave_cache = {}
    
    def get_registrations_count(self, obj):
        # Используем предварительно вычисленное значение из annotate
        if hasattr(obj, 'registrations_count'):
            return obj.registrations_count
        # Fallback: проверяем наличие регистрации и получаем количество
        if hasattr(obj, 'registration'):
            all_participant_ids = self.context.get('all_participant_ids')
            return obj.registration.get_registered_count(all_participant_ids)
        return 0

    def get_participants_count(self, obj):
        # Используем предварительно вычисленное значение из annotate
        if hasattr(obj, 'participants_count'):
            return obj.participants_count
        return 0
    
    def _get_wave_data(self, obj):
        """Получает данные волны с кэшированием для оптимизации"""
        cache_key = f"wave_{obj.id}"
        if cache_key not in self._wave_cache:
            wave = None
            assigned_participant_ids = set()
            participants_with_unassigned_registrations = set()
            
            # Получаем волну для текущего мероприятия через регистрацию
            event_registration = getattr(obj, 'registration', None)
            if event_registration:
                # Получаем первую волну, связанную с этой регистрацией
                waves = event_registration.waves.all()
                if waves.exists():
                    wave = waves.first()
            
            if wave:
                # Получаем ID всех участников, уже записанных на мероприятия волны
                for registration in wave.registrations.all():
                    event = registration.event
                    # Теперь participant_type определяется наличием event_group_v2
                    # Если есть event_group_v2 - это REGISTRATION, иначе - ALL
                    if event.event_group_v2_id and event.id != obj.id:
                        # Для типа REGISTRATION проверяем, зарегистрированы ли участники
                        if registration.registration_type == EventRegistration.RegistrationType.BUTTON:
                            # Участники в event_group_v2
                            assigned_participant_ids.update(
                                event.event_group_v2.get_participants().values_list('id', flat=True)
                            )
                        else:
                            # Участники в applicants
                            assigned_participant_ids.update(
                                registration.applicants.values_list('id', flat=True)
                            )
            
            self._wave_cache[cache_key] = {
                'wave': wave,
                'assigned_participant_ids': assigned_participant_ids,
                'participants_with_unassigned_registrations': participants_with_unassigned_registrations
            }
        
        return self._wave_cache[cache_key]

class EventBasicInfoSerializer(BaseEventSerializer):
    """Максимально оптимизированный сериализатор для событий"""
    # Временно отключаем медленные поля для улучшения производительности
    # available_participants = serializers.SerializerMethodField()
    # available_without_unassigned_events = serializers.SerializerMethodField()
    # can_convert = serializers.SerializerMethodField()
    
    class Meta:
        model = Event
        fields = ['id', 'name', 'participant_type', 'max_participants', 'registrations_count', 'participants_count']

class EventFullInfoSerializer(EventBasicInfoSerializer):
    """Полный сериализатор для событий с вычислением доступных участников"""
    available_participants = serializers.SerializerMethodField()
    available_without_unassigned_events = serializers.SerializerMethodField()
    can_convert = serializers.SerializerMethodField()
    
    class Meta:
        model = Event
        fields = ['id', 'name', 'participant_type', 'max_participants', 'registrations_count', 'participants_count', 'available_participants', 'available_without_unassigned_events', 'can_convert']

    def get_available_participants(self, obj):
        """Количество участников, которые подали заявку и еще не распределены на другие мероприятия волны"""
        registrations_count = self.get_registrations_count(obj)
        
        if registrations_count == 0:
            return 0
        
        # Используем кэшированные данные волны
        wave_data = self._get_wave_data(obj)
        
        if not wave_data['wave']:
            # Если нет волны, все участники доступны
            return registrations_count
        
        # Получаем ID участников текущего события через регистрацию
        current_event_participant_ids = set()
        if hasattr(obj, 'registration') and obj.registration:
            if obj.registration.registration_type == EventRegistration.RegistrationType.BUTTON:
                # Для типа button участники в event_group_v2
                if obj.event_group_v2:
                    current_event_participant_ids = set(
                        obj.event_group_v2.get_participants().values_list('id', flat=True)
                    )
            else:
                # Для типа application участники в applicants
                current_event_participant_ids = set(
                    obj.registration.applicants.values_list('id', flat=True)
                )
        
        # Подсчитываем доступных участников
        available_count = len(current_event_participant_ids - wave_data['assigned_participant_ids'])
        return available_count

    def get_available_without_unassigned_events(self, obj):
        """Количество участников, которые подали заявку, не попали на другие мероприятия волны 
        И не имеют заявок на мероприятия, где еще не было распределения (0 привязанных участников)"""
        registrations_count = self.get_registrations_count(obj)
        
        if registrations_count == 0:
            return 0
        
        # Используем кэшированные данные волны
        wave_data = self._get_wave_data(obj)
        
        if not wave_data['wave']:
            # Если нет волны, все участники доступны
            return registrations_count
        
        # Получаем ID участников текущего события через регистрацию
        current_event_participant_ids = set()
        if hasattr(obj, 'registration') and obj.registration:
            if obj.registration.registration_type == EventRegistration.RegistrationType.BUTTON:
                # Для типа button участники в event_group_v2
                if obj.event_group_v2:
                    current_event_participant_ids = set(
                        obj.event_group_v2.get_participants().values_list('id', flat=True)
                    )
            else:
                # Для типа application участники в applicants
                current_event_participant_ids = set(
                    obj.registration.applicants.values_list('id', flat=True)
                )
        
        # Исключаем участников, которые уже распределены на другие мероприятия волны
        # И участников, которые имеют заявки на нераспределенные мероприятия
        excluded_participants = (wave_data['assigned_participant_ids'] | 
                                wave_data['participants_with_unassigned_registrations'])
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

class EventWithRegistrationInfoSerializer(BaseEventSerializer):
    available_participants = serializers.SerializerMethodField()
    already_assigned_count = serializers.SerializerMethodField()
    available_without_unassigned_events = serializers.SerializerMethodField()
    can_convert = serializers.SerializerMethodField()
    can_convert_normal = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = ['id', 'name', 'participant_type', 'max_participants', 'registrations_count', 'participants_count', 'available_participants', 'already_assigned_count', 'available_without_unassigned_events', 'can_convert', 'can_convert_normal']

    def get_available_participants(self, obj):
        """Количество участников, которые подали заявку и еще не распределены на другие мероприятия волны"""
        # Получаем участников через регистрацию
        registration_participant_ids = set()
        if hasattr(obj, 'registration') and obj.registration:
            if obj.registration.registration_type == EventRegistration.RegistrationType.BUTTON:
                # Для типа button участники в event_group_v2
                if obj.event_group_v2:
                    registration_participant_ids = set(
                        obj.event_group_v2.get_participants().values_list('id', flat=True)
                    )
            else:
                # Для типа application участники в applicants
                registration_participant_ids = set(
                    obj.registration.applicants.values_list('id', flat=True)
                )
        
        if not registration_participant_ids:
            return 0
        
        wave_data = self._get_wave_data(obj)
        
        if not wave_data['wave']:
            # Если нет волны, все участники доступны
            return len(registration_participant_ids)
        
        # Подсчитываем доступных участников
        available_count = len(registration_participant_ids - wave_data['assigned_participant_ids'])
        
        return available_count
    
    def get_already_assigned_count(self, obj):
        """Количество участников, которые подали заявку, но уже распределены на другие мероприятия волны"""
        registrations_count = self.get_registrations_count(obj)
        available_count = self.get_available_participants(obj)
        return registrations_count - available_count
    
    def get_available_without_unassigned_events(self, obj):
        """Количество участников, которые подали заявку, не попали на другие мероприятия волны 
        И не имеют заявок на мероприятия, где еще не было распределения (0 привязанных участников)"""
        # Получаем участников через регистрацию
        registration_participant_ids = set()
        if hasattr(obj, 'registration') and obj.registration:
            if obj.registration.registration_type == EventRegistration.RegistrationType.BUTTON:
                # Для типа button участники в event_group_v2
                if obj.event_group_v2:
                    registration_participant_ids = set(
                        obj.event_group_v2.get_participants().values_list('id', flat=True)
                    )
            else:
                # Для типа application участники в applicants
                registration_participant_ids = set(
                    obj.registration.applicants.values_list('id', flat=True)
                )
        
        if not registration_participant_ids:
            return 0
        
        wave_data = self._get_wave_data(obj)
        
        if not wave_data['wave']:
            # Если нет волны, все участники доступны
            return len(registration_participant_ids)
        
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
        
        # Проверяем наличие event_group_v2 вместо participant_type
        return (
            obj.event_group_v2_id is not None and
            self.get_registrations_count(obj) > 0 and
            available_count > 0 and
            (obj.max_participants is None or available_count <= obj.max_participants)
        )

class EventWaveSerializer(serializers.ModelSerializer):
    """Сериализатор для волны мероприятий"""
    registrations = serializers.SerializerMethodField()
    registration_ids = BulkPrimaryKeyRelatedField(
        many=True,
        write_only=True,
        source='registrations',
        queryset=EventRegistration.objects.all(),
        required=False,
        allow_empty=True,
        select_related="event",
    )
    events = serializers.SerializerMethodField()

    class Meta:
        model = EventWave
        fields = [
            'id', 'name', 'eventum', 'registrations', 'registration_ids', 'events'
        ]
        read_only_fields = ['id', 'eventum', 'events']

    def _get_group_participant_ids(self, group, visited_groups=None):
        """
        Получает ID участников группы используя уже загруженные данные (prefetch_related).
        Работает полностью в памяти Python без дополнительных запросов к БД.
        Для рекурсивных групп может потребоваться дополнительная обработка.
        """
        if not group:
            return set()
        
        if visited_groups is None:
            visited_groups = set()
        
        # Предотвращаем циклические ссылки
        if group.id in visited_groups:
            return set()
        
        visited_groups.add(group.id)
        
        # Пытаемся использовать кеш
        from django.core.cache import cache
        cache_key = f'group_participants_{group.id}_{group.eventum_id}'
        cached_ids = cache.get(cache_key)
        if cached_ids is not None:
            return set(cached_ids)
        
        # Получаем все participant_relations из prefetch_related
        # ВАЖНО: не используем fallback к .all(), чтобы избежать запросов к БД
        participant_relations = []
        if hasattr(group, '_prefetched_objects_cache') and 'participant_relations' in group._prefetched_objects_cache:
            participant_relations = group._prefetched_objects_cache['participant_relations']
        # Если prefetch не сработал, возвращаем пустой список (не делаем запрос к БД)
        # Это может произойти только если prefetch не был настроен правильно
        
        # Получаем все group_relations из prefetch_related
        # ВАЖНО: не используем fallback к .all(), чтобы избежать запросов к БД
        group_relations = []
        if hasattr(group, '_prefetched_objects_cache') and 'group_relations' in group._prefetched_objects_cache:
            group_relations = group._prefetched_objects_cache['group_relations']
        # Если prefetch не сработал, возвращаем пустой список (не делаем запрос к БД)
        
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
            # Используем all_participant_ids из контекста
            all_participant_ids = self.context.get('all_participant_ids', set())
            
            # Исключаем excluded участников
            excluded_participant_ids = set()
            for rel in participant_relations:
                if rel.relation_type == ParticipantGroupV2ParticipantRelation.RelationType.EXCLUSIVE:
                    excluded_participant_ids.add(rel.participant_id)
            
            # Исключаем участников из excluded групп (рекурсивно)
            for group_rel in group_relations:
                if group_rel.relation_type == ParticipantGroupV2GroupRelation.RelationType.EXCLUSIVE:
                    target_group = group_rel.target_group
                    excluded_participant_ids.update(
                        self._get_group_participant_ids(target_group, visited_groups.copy())
                    )
            
            return all_participant_ids - excluded_participant_ids
        else:
            # Стандартная логика включений/исключений
            included_participant_ids = set()
            excluded_participant_ids = set()
            
            # Обрабатываем прямые связи с участниками
            for rel in participant_relations:
                if rel.relation_type == ParticipantGroupV2ParticipantRelation.RelationType.INCLUSIVE:
                    included_participant_ids.add(rel.participant_id)
                elif rel.relation_type == ParticipantGroupV2ParticipantRelation.RelationType.EXCLUSIVE:
                    excluded_participant_ids.add(rel.participant_id)
            
            # Обрабатываем связи с группами
            for group_rel in group_relations:
                target_group = group_rel.target_group
                target_participant_ids = self._get_group_participant_ids(target_group, visited_groups.copy())
                
                if group_rel.relation_type == ParticipantGroupV2GroupRelation.RelationType.INCLUSIVE:
                    included_participant_ids.update(target_participant_ids)
                elif group_rel.relation_type == ParticipantGroupV2GroupRelation.RelationType.EXCLUSIVE:
                    excluded_participant_ids.update(target_participant_ids)
            
            # Исключаем участников из списка включенных
            included_participant_ids -= excluded_participant_ids
            
            return included_participant_ids
    
    def _has_participant_in_group(self, group, participant_id):
        """
        Проверяет участие в группе используя уже загруженные данные (prefetch_related).
        Работает полностью в памяти Python без дополнительных запросов к БД.
        """
        if not group:
            return False
        
        participant_ids = self._get_group_participant_ids(group)
        return participant_id in participant_ids
    
    def get_registrations(self, obj):
        """Получить регистрации волны"""
        if obj.pk:
            # ИСПОЛЬЗУЕМ prefetch'енные registrations вместо нового запроса
            if hasattr(obj, '_prefetched_objects_cache') and 'registrations' in obj._prefetched_objects_cache:
                registrations = obj._prefetched_objects_cache['registrations']
            else:
                # Fallback: если prefetch не сработал
                registrations = obj.registrations.all().select_related('event', 'allowed_group').prefetch_related('applicants')

            request = self.context.get('request')
            # ИСПОЛЬЗУЕМ participant из контекста вместо запроса к БД
            participant_cached = self.context.get('_current_participant') or self.context.get('current_participant')
            if participant_cached is None and request and getattr(request, 'user', None) and request.user.is_authenticated:
                # Если participant не загружен в контексте, пытаемся загрузить
                # (это не должно происходить, если ViewSet правильно настроен)
                try:
                    sample_eventum = None
                    for r in registrations:
                        if getattr(r, 'event', None) is not None:
                            sample_eventum = r.event.eventum
                            break
                    if sample_eventum is not None:
                        participant_cached = Participant.objects.get(user=request.user, eventum=sample_eventum)
                    else:
                        participant_cached = False
                except Participant.DoesNotExist:
                    participant_cached = False
                self.context['_current_participant'] = participant_cached

            # Создаем минимальное представление регистраций
            result = []
            for reg in registrations:
                # Вычисляем доступность на уровне регистрации
                # Простая логика: если allowed_group указан, проверяем вхождение участника в группу
                if not reg.allowed_group_id:
                    # Если группа доступа не указана, событие доступно всем
                    is_accessible = True
                else:
                    # Если группа доступа указана, проверяем вхождение участника
                    if participant_cached is False or participant_cached is None:
                        # Участник не найден - событие недоступно
                        is_accessible = False
                    elif not hasattr(participant_cached, 'id'):
                        # participant_cached не является объектом Participant - событие недоступно
                        is_accessible = False
                    else:
                        # Проверяем вхождение участника в allowed_group
                        grp = reg.allowed_group
                        if grp:
                            is_accessible = self._has_participant_in_group(grp, participant_cached.id)
                        else:
                            # Если allowed_group_id есть, но группа не загружена - считаем недоступным
                            # (это может произойти, если группа была удалена или prefetch не сработал)
                            is_accessible = False

                # Оптимизированный подсчет зарегистрированных участников
                # Используем prefetch'енные данные вместо запросов к БД
                if reg.registration_type == EventRegistration.RegistrationType.BUTTON:
                    # Для типа button считаем участников в event_group_v2
                    if reg.event.event_group_v2:
                        participant_ids = self._get_group_participant_ids(reg.event.event_group_v2)
                        registered_count = len(participant_ids)
                    else:
                        registered_count = 0
                else:
                    # Для типа application считаем заявки из prefetch'енных applicants
                    if hasattr(reg, '_prefetched_objects_cache') and 'applicants' in reg._prefetched_objects_cache:
                        registered_count = len(reg._prefetched_objects_cache['applicants'])
                    else:
                        # Fallback: если prefetch не сработал
                        registered_count = reg.applicants.count()
                
                result.append({
                    'id': reg.id,
                    'event': {
                        'id': reg.event.id,
                        'name': reg.event.name,
                    },
                    'registration_type': reg.registration_type,
                    'max_participants': reg.max_participants,
                    'allowed_group': reg.allowed_group_id,
                    'registered_count': registered_count,
                    'is_accessible': is_accessible,
                })

            return result
        return []
    
    def get_events(self, obj):
        """Получить события, связанные с регистрациями в волне, используя уже префетченные связи"""
        if not obj.pk:
            return []

        # ИСПОЛЬЗУЕМ prefetch'енные registrations вместо нового запроса
        if hasattr(obj, '_prefetched_objects_cache') and 'registrations' in obj._prefetched_objects_cache:
            registrations = obj._prefetched_objects_cache['registrations']
        else:
            # Fallback: если prefetch не сработал
            registrations = list(obj.registrations.all())
        
        events = []
        seen_ids = set()
        for reg in registrations:
            ev = getattr(reg, 'event', None)
            if ev is not None and ev.id not in seen_ids:
                seen_ids.add(ev.id)
                events.append(ev)

        serializer = EventSerializer(events, many=True, context=self.context)
        return serializer.data
    
    def validate_registration_ids(self, value):
        """Валидация registration_ids - регистрации должны принадлежать тому же eventum"""
        if not value:
            return value
        
        eventum = self.context.get('eventum')
        if eventum:
            eventum_id = getattr(eventum, 'id', eventum)
            invalid_registrations = [reg for reg in value if reg.event.eventum_id != eventum_id]
            if invalid_registrations:
                names = ', '.join(reg.event.name for reg in invalid_registrations)
                raise serializers.ValidationError(
                    f"Регистрации на мероприятия {names} не принадлежат данному eventum"
                )
        return value

class LocationSerializer(serializers.ModelSerializer):
    parent = serializers.SerializerMethodField(read_only=True)
    parent_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    children = serializers.SerializerMethodField(read_only=True)
    full_path = serializers.SerializerMethodField(read_only=True)
    effective_address = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = Location
        fields = [
            'id', 'name', 'slug', 'kind', 'address', 'floor', 'notes',
            'parent', 'parent_id', 'children', 'full_path', 'effective_address'
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
    
    def get_effective_address(self, obj):
        """Возвращает адрес локации или адрес ближайшего родителя с адресом"""
        current = obj
        
        # Ищем адрес у текущей локации или у ближайшего родителя
        while current:
            if current.address:
                return current.address
            current = current.parent
        
        return None
    
    
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
    # Поле для чтения связанной группы V2 (упрощенно: id и name)
    event_group_v2 = serializers.SerializerMethodField(read_only=True)
    # Поле для чтения id связанной группы V2
    event_group_v2_id = serializers.SerializerMethodField(read_only=True)
    # Поле для записи id связанной группы V2
    event_group_v2_id_write = serializers.PrimaryKeyRelatedField(
        write_only=True,
        required=False,
        allow_null=True,
        source='event_group_v2',
        queryset=ParticipantGroupV2.objects.all()
    )
    registrations_count = serializers.SerializerMethodField()
    is_registered = serializers.SerializerMethodField()
    is_participant = serializers.SerializerMethodField()
    # participant_type теперь вычисляемое поле на основе event_group_v2
    participant_type = serializers.SerializerMethodField(read_only=True)
    # registration_type - тип регистрации из EventRegistration
    registration_type = serializers.SerializerMethodField(read_only=True)
    # Информация о регистрации для фронтенда
    registration_max_participants = serializers.SerializerMethodField(read_only=True)
    participants_count = serializers.SerializerMethodField(read_only=True)
    
    # Обычные поля времени - работаем без таймзон
    start_time = serializers.DateTimeField()
    end_time = serializers.DateTimeField()

    class Meta:
        model = Event
        fields = [
            'id', 'name', 'description', 'start_time', 'end_time',
            'participant_type', 'max_participants', 'image_url',
            'participants', 'groups', 'tags', 'tag_ids', 'group_tags', 'group_tag_ids', 
            'locations', 'location_ids', 'event_group_v2', 'event_group_v2_id', 'event_group_v2_id_write',
            'registrations_count', 'is_registered', 'is_participant', 'registration_type',
            'registration_max_participants', 'participants_count'
        ]
        extra_kwargs = {
            'event_group_v2_id_write': {'write_only': True},
        }
    
    def get_participant_type(self, obj):
        """Вычисляем participant_type на основе наличия event_group_v2"""
        if obj.event_group_v2_id:
            return Event.ParticipantType.REGISTRATION
        return Event.ParticipantType.ALL
    
    def get_registration_type(self, obj):
        """Получить тип регистрации из EventRegistration"""
        if hasattr(obj, 'registration') and obj.registration:
            return obj.registration.registration_type
        return None

    # флаг доступности перенесен на уровень регистрации

    def create(self, validated_data):
        """Создание события с обработкой связей"""
        # participant_type теперь не используется - он вычисляется из event_group_v2
        validated_data.pop('participant_type', None)
        
        # Извлекаем many-to-many поля
        participants = validated_data.pop('participants', None)
        groups = validated_data.pop('groups', None)
        tags = validated_data.pop('tags', None)
        group_tags = validated_data.pop('group_tags', None)
        locations = validated_data.pop('locations', None)
        # One-to-one поле (может приходить как event_group_v2_id_write или event_group_v2)
        event_group_v2 = validated_data.pop('event_group_v2', None) or validated_data.pop('event_group_v2_id_write', None)
        
        # Создаем событие
        instance = super().create(validated_data)
        
        # Устанавливаем many-to-many поля
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
        # Устанавливаем связь 1:1
        if event_group_v2 is not None:
            instance.event_group_v2 = event_group_v2
            instance.save(update_fields=['event_group_v2'])
        
        return instance

    def update(self, instance, validated_data):
        """Переопределяем update для правильной обработки связей"""
        # Извлекаем many-to-many поля
        participants = validated_data.pop('participants', None)
        groups = validated_data.pop('groups', None)
        tags = validated_data.pop('tags', None)
        group_tags = validated_data.pop('group_tags', None)
        locations = validated_data.pop('locations', None)
        # One-to-one поле
        event_group_v2 = validated_data.pop('event_group_v2', 'NOT_PROVIDED')
        if event_group_v2 == 'NOT_PROVIDED':
            event_group_v2 = validated_data.pop('event_group_v2_id_write', 'NOT_PROVIDED')
        
        # participant_type теперь не используется - он вычисляется из event_group_v2
        validated_data.pop('participant_type', None)
        
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
        # Обновляем связь 1:1
        if event_group_v2 != 'NOT_PROVIDED':
            instance.event_group_v2 = event_group_v2
            instance.save(update_fields=['event_group_v2'])
        
        return instance

    def get_registrations_count(self, obj):
        """Получить количество записанных участников"""
        # Проверяем, есть ли настройка регистрации
        if hasattr(obj, 'registration'):
            all_participant_ids = self.context.get('all_participant_ids')
            return obj.registration.get_registered_count(all_participant_ids)
        
        # Если нет настройки регистрации, возвращаем 0
        return 0

    def _get_group_participant_ids(self, group, visited_groups=None):
        """
        Получает ID участников группы используя уже загруженные данные (prefetch_related).
        Работает полностью в памяти Python без дополнительных запросов к БД.
        Для рекурсивных групп может потребоваться дополнительная обработка.
        """
        if not group:
            return set()
        
        if visited_groups is None:
            visited_groups = set()
        
        # Предотвращаем циклические ссылки
        if group.id in visited_groups:
            return set()
        
        visited_groups.add(group.id)
        
        # Пытаемся использовать кеш
        from django.core.cache import cache
        cache_key = f'group_participants_{group.id}_{group.eventum_id}'
        cached_ids = cache.get(cache_key)
        if cached_ids is not None:
            return set(cached_ids)
        
        # Получаем все participant_relations из prefetch_related
        # ВАЖНО: не используем fallback к .all(), чтобы избежать запросов к БД
        participant_relations = []
        if hasattr(group, '_prefetched_objects_cache') and 'participant_relations' in group._prefetched_objects_cache:
            participant_relations = group._prefetched_objects_cache['participant_relations']
        # Если prefetch не сработал, возвращаем пустой список (не делаем запрос к БД)
        # Это может произойти только если prefetch не был настроен правильно
        
        # Получаем все group_relations из prefetch_related
        # ВАЖНО: не используем fallback к .all(), чтобы избежать запросов к БД
        group_relations = []
        if hasattr(group, '_prefetched_objects_cache') and 'group_relations' in group._prefetched_objects_cache:
            group_relations = group._prefetched_objects_cache['group_relations']
        # Если prefetch не сработал, возвращаем пустой список (не делаем запрос к БД)
        
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
            # Используем all_participant_ids из контекста
            all_participant_ids = self.context.get('all_participant_ids', set())
            
            # Исключаем excluded участников
            excluded_participant_ids = set()
            for rel in participant_relations:
                if rel.relation_type == ParticipantGroupV2ParticipantRelation.RelationType.EXCLUSIVE:
                    excluded_participant_ids.add(rel.participant_id)
            
            # Исключаем участников из excluded групп (рекурсивно)
            for group_rel in group_relations:
                if group_rel.relation_type == ParticipantGroupV2GroupRelation.RelationType.EXCLUSIVE:
                    target_group = group_rel.target_group
                    excluded_participant_ids.update(
                        self._get_group_participant_ids(target_group, visited_groups.copy())
                    )
            
            return all_participant_ids - excluded_participant_ids
        else:
            # Стандартная логика включений/исключений
            included_participant_ids = set()
            excluded_participant_ids = set()
            
            # Обрабатываем прямые связи с участниками
            for rel in participant_relations:
                if rel.relation_type == ParticipantGroupV2ParticipantRelation.RelationType.INCLUSIVE:
                    included_participant_ids.add(rel.participant_id)
                elif rel.relation_type == ParticipantGroupV2ParticipantRelation.RelationType.EXCLUSIVE:
                    excluded_participant_ids.add(rel.participant_id)
            
            # Обрабатываем связи с группами
            for group_rel in group_relations:
                target_group = group_rel.target_group
                target_participant_ids = self._get_group_participant_ids(target_group, visited_groups.copy())
                
                if group_rel.relation_type == ParticipantGroupV2GroupRelation.RelationType.INCLUSIVE:
                    included_participant_ids.update(target_participant_ids)
                elif group_rel.relation_type == ParticipantGroupV2GroupRelation.RelationType.EXCLUSIVE:
                    excluded_participant_ids.update(target_participant_ids)
            
            # Исключаем участников из списка включенных
            included_participant_ids -= excluded_participant_ids
            
            return included_participant_ids
    
    def _has_participant_in_group(self, group, participant_id):
        """
        Проверяет участие в группе используя уже загруженные данные (prefetch_related).
        Работает полностью в памяти Python без дополнительных запросов к БД.
        """
        if not group:
            return False
        
        participant_ids = self._get_group_participant_ids(group)
        return participant_id in participant_ids
    
    def get_is_registered(self, obj):
        """Проверить, записан ли текущий пользователь (или указанный участник) на мероприятие"""
        request = self.context.get('request')
        participant_id = self.context.get('participant_id')
        
        # ИСПОЛЬЗУЕМ participant из контекста вместо запроса к БД
        # Сначала проверяем, есть ли уже загруженный participant в контексте
        participant = self.context.get('current_participant')
        
        if participant_id:
            # Для просмотра от лица другого участника
            # Если participant уже загружен в контексте, используем его
            if participant and participant.id == participant_id:
                # Уже загружен, используем
                pass
            else:
                # Если не загружен, загружаем (fallback)
                from .models import Participant
                try:
                    participant = Participant.objects.get(id=participant_id, eventum=obj.eventum)
                except Participant.DoesNotExist:
                    return False
        else:
            # Обычная логика для текущего пользователя
            if not participant:
                return False
        
        # Проверяем, есть ли настройка регистрации
        if not hasattr(obj, 'registration'):
            return False
        
        registration = obj.registration
        
        # В зависимости от типа регистрации проверяем по-разному
        if registration.registration_type == EventRegistration.RegistrationType.BUTTON:
            # Для типа button проверяем, входит ли участник в event_group_v2
            if obj.event_group_v2:
                # ИСПОЛЬЗУЕМ метод, который работает с уже загруженными данными
                return self._has_participant_in_group(obj.event_group_v2, participant.id)
            return False
        else:
            # Для типа application проверяем:
            # 1. Участник в event_group_v2 (заявка одобрена и он добавлен в группу)
            # 2. ИЛИ участник в applicants (подал заявку, но еще не одобрена)
            if obj.event_group_v2:
                if self._has_participant_in_group(obj.event_group_v2, participant.id):
                    return True
            
            # Проверяем applicants (используем prefetch'енные данные)
            if hasattr(registration, '_prefetched_objects_cache') and 'applicants' in registration._prefetched_objects_cache:
                applicant_ids = {app.id for app in registration._prefetched_objects_cache['applicants']}
                return participant.id in applicant_ids
            else:
                # Fallback: если prefetch не сработал
                return registration.applicants.filter(id=participant.id).exists()
    
    def get_is_participant(self, obj):
        """Проверить, участвует ли участник в мероприятии (для расписания, без проверки регистрации)"""
        request = self.context.get('request')
        participant_id = self.context.get('participant_id')
        
        # ИСПОЛЬЗУЕМ participant из контекста вместо запроса к БД
        # Сначала проверяем, есть ли уже загруженный participant в контексте
        participant = self.context.get('current_participant')
        
        if participant_id:
            # Для просмотра от лица другого участника
            # Если participant уже загружен в контексте, используем его
            if participant and participant.id == participant_id:
                # Уже загружен, используем
                pass
            else:
                # Если не загружен, загружаем (fallback)
                from .models import Participant
                try:
                    participant = Participant.objects.get(id=participant_id, eventum=obj.eventum)
                except Participant.DoesNotExist:
                    return False
        else:
            # Обычная логика для текущего пользователя
            if not participant:
                return False
        
        # Если есть event_group_v2, проверяем участие через него
        # (это работает для всех мероприятий, включая те, где нет регистрации)
        if obj.event_group_v2:
            # ИСПОЛЬЗУЕМ метод, который работает с уже загруженными данными
            return self._has_participant_in_group(obj.event_group_v2, participant.id)
        
        # Для старых мероприятий без v2 групп используем старую логику
        # participant_type уже вычислен как строка через get_participant_type
        if obj.participant_type == 'all':
            return True
        
        if obj.participant_type == 'manual':
            # Прямое назначение участника - используем уже загруженные participants
            if hasattr(obj, '_prefetched_objects_cache') and 'participants' in obj._prefetched_objects_cache:
                participant_ids = {p.id for p in obj._prefetched_objects_cache['participants']}
                if participant.id in participant_ids:
                    return True
            else:
                # Fallback, если prefetch не сработал
                if obj.participants.filter(id=participant.id).exists():
                    return True
            
            # Назначение через группы участника (старые группы) - используем загруженные данные
            if hasattr(participant, '_prefetched_objects_cache') and 'groups' in participant._prefetched_objects_cache:
                participant_group_ids = {g.id for g in participant._prefetched_objects_cache['groups']}
            else:
                participant_group_ids = set(participant.groups.values_list('id', flat=True))
            
            if hasattr(obj, '_prefetched_objects_cache') and 'groups' in obj._prefetched_objects_cache:
                event_group_ids = {g.id for g in obj._prefetched_objects_cache['groups']}
            else:
                event_group_ids = set(obj.groups.values_list('id', flat=True))
            
            if participant_group_ids & event_group_ids:
                return True
            
            # Назначение через теги групп участника - используем загруженные данные
            if hasattr(participant, '_prefetched_objects_cache') and 'groups' in participant._prefetched_objects_cache:
                participant_group_tag_ids = set()
                for group in participant._prefetched_objects_cache['groups']:
                    if hasattr(group, '_prefetched_objects_cache') and 'tags' in group._prefetched_objects_cache:
                        participant_group_tag_ids.update(tag.id for tag in group._prefetched_objects_cache['tags'])
                    else:
                        participant_group_tag_ids.update(group.tags.values_list('id', flat=True))
            else:
                participant_group_tag_ids = set(
                    participant.groups.values_list('tags__id', flat=True)
                )
            
            if hasattr(obj, '_prefetched_objects_cache') and 'group_tags' in obj._prefetched_objects_cache:
                event_group_tag_ids = {tag.id for tag in obj._prefetched_objects_cache['group_tags']}
            else:
                event_group_tag_ids = set(obj.group_tags.values_list('id', flat=True))
            
            if participant_group_tag_ids & event_group_tag_ids:
                return True
        
        return False
    
    def get_registration_max_participants(self, obj):
        """Получить максимальное количество участников из регистрации"""
        if hasattr(obj, 'registration') and obj.registration:
            return obj.registration.max_participants
        return None
    
    def get_participants_count(self, obj):
        """Получить количество участников по v2 группе (всегда, если группа есть)"""
        # Если группы нет, возвращаем 0
        if not obj.event_group_v2:
            return 0
        
        # Получаем количество участников по v2 группе
        # Используем get_participants_count() который работает с prefetch'нутыми данными в памяти
        # Данные уже загружены через prefetch_related в views.py
        all_participant_ids = self.context.get('all_participant_ids')
        return obj.event_group_v2.get_participants_count(all_participant_ids)
    
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
        """Валидация на уровне объекта"""
        # participant_type теперь вычисляется автоматически из event_group_v2
        # Проверяем max_participants только если есть event_group_v2 (регистрация)
        max_participants = data.get('max_participants')
        event_group_v2 = data.get('event_group_v2')
        
        # Если устанавливается event_group_v2 (не None), значит это регистрация
        # Проверяем max_participants для регистрации
        if event_group_v2 is not None and event_group_v2 != 'NOT_PROVIDED':
            # event_group_v2 установлен - это регистрация
            if max_participants is not None and max_participants <= 0:
                raise serializers.ValidationError({
                    'max_participants': 'max_participants must be greater than 0 if specified'
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

    def validate_event_group_v2_id(self, value):
        """Группа V2 должна принадлежать тому же eventum"""
        if value is None:
            return value
        eventum = self.context.get('eventum')
        if eventum:
            eventum_id = getattr(eventum, 'id', eventum)
            if value.eventum_id != eventum_id:
                raise serializers.ValidationError(
                    "Группа V2 не принадлежит данному eventum"
                )
        return value

    def get_event_group_v2_id(self, obj):
        """Возвращает ID связанной группы V2 для чтения"""
        return getattr(obj, 'event_group_v2_id', None)
    
    def get_event_group_v2(self, obj):
        if getattr(obj, 'event_group_v2_id', None):
            return {
                'id': obj.event_group_v2_id,
                'name': obj.event_group_v2.name,
            }
        return None


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
    """Сериализатор для настройки регистрации на мероприятие"""
    event = EventSerializer(read_only=True)
    event_id = serializers.IntegerField(write_only=True)
    allowed_group = serializers.PrimaryKeyRelatedField(
        queryset=ParticipantGroupV2.objects.all(),
        required=False,
        allow_null=True
    )
    applicants = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Participant.objects.all(),
        required=False
    )
    registered_count = serializers.SerializerMethodField()
    event_participants_count = serializers.SerializerMethodField()
    
    class Meta:
        model = EventRegistration
        fields = [
            'id', 'event', 'event_id', 'registration_type', 'max_participants', 
            'allowed_group', 'applicants', 'registered_count', 'event_participants_count'
        ]
        read_only_fields = ['id', 'event', 'registered_count', 'event_participants_count']
    
    def create(self, validated_data):
        """Создание регистрации с обработкой event_id"""
        event_id = validated_data.pop('event_id')
        applicants = validated_data.pop('applicants', [])
        
        # Получаем eventum из контекста для валидации
        eventum = self.context.get('eventum')
        
        try:
            event = Event.objects.get(id=event_id)
        except Event.DoesNotExist:
            raise serializers.ValidationError({
                'event_id': f'Event with ID {event_id} does not exist'
            })
        
        # Проверяем, что событие принадлежит тому же eventum
        if eventum and event.eventum != eventum:
            raise serializers.ValidationError({
                'event_id': 'Event must belong to the same eventum'
            })
        
        # Проверяем, что у события еще нет регистрации
        try:
            event.registration
            raise serializers.ValidationError({
                'event_id': 'Event already has a registration'
            })
        except EventRegistration.DoesNotExist:
            pass
        
        validated_data['event'] = event
        registration = super().create(validated_data)
        
        # Добавляем applicants если они есть
        if applicants:
            registration.applicants.set(applicants)
        
        return registration
    
    def update(self, instance, validated_data):
        """Обновление регистрации с обработкой event_id"""
        event_id = validated_data.pop('event_id', None)
        applicants = validated_data.pop('applicants', None)
        
        if event_id is not None:
            eventum = self.context.get('eventum')
            try:
                event = Event.objects.get(id=event_id)
            except Event.DoesNotExist:
                raise serializers.ValidationError({
                    'event_id': f'Event with ID {event_id} does not exist'
                })
            
            if eventum and event.eventum != eventum:
                raise serializers.ValidationError({
                    'event_id': 'Event must belong to the same eventum'
                })
            
            validated_data['event'] = event
        
        registration = super().update(instance, validated_data)
        
        # Обновляем applicants если они переданы
        if applicants is not None:
            # Для типа APPLICATION заявок может быть больше чем max_participants,
            # администратор потом выберет, кого одобрить, поэтому валидация не нужна
            registration.applicants.set(applicants)
        
        return registration
    
    def get_registered_count(self, obj):
        """Получить количество зарегистрированных участников"""
        all_participant_ids = self.context.get('all_participant_ids')
        return obj.get_registered_count(all_participant_ids)
    
    def get_event_participants_count(self, obj):
        """Получить количество участников мероприятия (связанных через группы v2)"""
        event = obj.event
        if not event:
            return 0
        
        # Проверяем прямую связь через event_group_v2
        if hasattr(event, 'event_group_v2') and event.event_group_v2:
            try:
                return event.event_group_v2.get_participants_count()
            except (AttributeError, Exception):
                pass
        
        # Если нет прямой связи, проверяем через event-relations-v2
        from .models import ParticipantGroupV2EventRelation, ParticipantGroupV2ParticipantRelation
        from django.db.models import Prefetch
        
        relations = ParticipantGroupV2EventRelation.objects.filter(
            event=event
        ).select_related('group').prefetch_related(
            Prefetch(
                'group__participant_relations',
                queryset=ParticipantGroupV2ParticipantRelation.objects.filter(
                    relation_type=ParticipantGroupV2ParticipantRelation.RelationType.INCLUSIVE
                ).select_related('participant')
            )
        )
        
        if not relations.exists():
            return 0
        
        # Собираем всех участников из всех связанных групп
        all_participant_ids = set()
        for relation in relations:
            group = relation.group
            if group and hasattr(group, 'participant_relations'):
                # Используем prefetched relations
                for participant_relation in group.participant_relations.all():
                    if (participant_relation.relation_type == ParticipantGroupV2ParticipantRelation.RelationType.INCLUSIVE and 
                        participant_relation.participant_id):
                        all_participant_ids.add(participant_relation.participant_id)
        
        return len(all_participant_ids)
