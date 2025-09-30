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
        fields = ['id', 'name', 'slug', 'description']
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
                validated_data['name'] = user.name  # Автоматически заполняем имя
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

class EventWithRegistrationInfoSerializer(serializers.ModelSerializer):
    registrations_count = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = ['id', 'name', 'participant_type', 'max_participants', 'registrations_count']

    def get_registrations_count(self, obj):
        return EventRegistration.objects.filter(event=obj).count()

class EventWaveSerializer(serializers.ModelSerializer):
    tag = EventTagSerializer(read_only=True)
    tag_id = serializers.PrimaryKeyRelatedField(
        write_only=True, source='tag', queryset=EventTag.objects.all()
    )
    events = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = EventWave
        fields = ['id', 'name', 'tag', 'tag_id', 'events']

    def get_events(self, obj):
        # Все события текущего eventum с тегом волны
        events_qs = Event.objects.filter(eventum=obj.eventum, tags=obj.tag)
        return EventWithRegistrationInfoSerializer(events_qs, many=True).data

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
    
    class Meta:
        model = Location
        fields = [
            'id', 'name', 'slug', 'kind', 'address', 'floor', 'notes',
            'parent', 'parent_id', 'children'
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
    
    # Обычные поля времени - работаем без таймзон
    start_time = serializers.DateTimeField()
    end_time = serializers.DateTimeField()

    class Meta:
        model = Event
        fields = [
            'id', 'name', 'description', 'start_time', 'end_time',
            'participant_type', 'max_participants', 'image_url',
            'participants', 'groups', 'tags', 'tag_ids', 'group_tags', 'group_tag_ids', 
            'locations', 'location_ids'
        ]

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
        elif participant_type in ['all', 'manual']:
            if max_participants is not None:
                raise serializers.ValidationError({
                    'max_participants': 'max_participants should not be set for all or manual type events'
                })
        
        # Check if trying to change participant_type from manual when there are existing connections
        if self.instance and self.instance.pk:
            original_participant_type = self.instance.participant_type
            new_participant_type = participant_type or original_participant_type
            
            # If changing from manual to another type, check for existing connections
            if (original_participant_type == 'manual' and 
                new_participant_type != 'manual'):
                
                # Check for participants
                if self.instance.participants.exists():
                    raise serializers.ValidationError({
                        'participant_type': 'Нельзя изменить тип участников с "manual" на другой тип, '
                                          'пока не удалены все связи с участниками'
                    })
                
                # Check for groups
                if self.instance.groups.exists():
                    raise serializers.ValidationError({
                        'participant_type': 'Нельзя изменить тип участников с "manual" на другой тип, '
                                          'пока не удалены все связи с группами'
                    })
                
                # Check for group tags
                if self.instance.group_tags.exists():
                    raise serializers.ValidationError({
                        'participant_type': 'Нельзя изменить тип участников с "manual" на другой тип, '
                                          'пока не удалены все связи с тегами групп'
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
