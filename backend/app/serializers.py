from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.utils.text import slugify
from transliterate import translit
from .models import (
    Eventum, Participant, ParticipantGroup, 
    GroupTag, Event, EventTag, UserProfile, UserRole, Location
)

class EventumSerializer(serializers.ModelSerializer):
    class Meta:
        model = Eventum
        fields = ['id', 'name', 'slug', 'description']
        read_only_fields = ['slug']
    
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
            'tags': [{'id': tag.id, 'name': tag.name, 'slug': tag.slug} for tag in group.tags.all()]
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
        """Переопределяем update для автоматического заполнения имени из пользователя"""
        user_id = validated_data.pop('user_id', None)
        if user_id:
            try:
                user = UserProfile.objects.get(id=user_id)
                validated_data['user'] = user
                validated_data['name'] = user.name  # Автоматически заполняем имя
            except UserProfile.DoesNotExist:
                raise serializers.ValidationError(f"Пользователь с ID {user_id} не найден")
        
        return super().update(instance, validated_data)

class GroupTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = GroupTag
        fields = ['id', 'name', 'slug']

class ParticipantGroupSerializer(serializers.ModelSerializer):
    participants = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Participant.objects.all(),
        required=False
    )
    tags = GroupTagSerializer(many=True, read_only=True)
    tag_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        write_only=True,
        source='tags',
        queryset=GroupTag.objects.all(),
        required=False
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
    
    def validate_participants(self, value):
        """Проверяем, что все участники принадлежат тому же eventum"""
        if not value:
            return value
            
        # Получаем eventum из контекста
        eventum = self.context.get('eventum')
        if not eventum:
            return value
            
        # Проверяем, что все участники принадлежат тому же eventum
        invalid_participants = [p for p in value if p.eventum != eventum]
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

class EventSerializer(serializers.ModelSerializer):
    participants = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Participant.objects.all(),
        required=False,
        allow_empty=True
    )
    groups = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=ParticipantGroup.objects.all(),
        required=False,
        allow_empty=True
    )
    tags = EventTagSerializer(many=True, read_only=True)
    tag_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        write_only=True,
        source='tags',
        queryset=EventTag.objects.all(),
        required=False,
        allow_empty=True
    )
    location_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        source='location',
        queryset=Location.objects.all(),
        required=False,
        allow_null=True
    )

    class Meta:
        model = Event
        fields = [
            'id', 'name', 'description', 'start_time', 'end_time',
            'participants', 'groups', 'tags', 'tag_ids', 'location_id'
        ]

    def validate_location_id(self, value):
        """Валидация location_id - локация должна принадлежать тому же eventum"""
        if value is None:
            return value
        
        # Получаем eventum из контекста
        eventum = self.context.get('eventum')
        if eventum and value.eventum != eventum:
            raise serializers.ValidationError(
                f"Локация '{value.name}' не принадлежит данному eventum"
            )
        
        return value

    def validate_tag_ids(self, value):
        """Валидация tag_ids - теги должны принадлежать тому же eventum"""
        if not value:
            return value
        
        # Получаем eventum из контекста
        eventum = self.context.get('eventum')
        if eventum:
            for tag in value:
                if tag.eventum != eventum:
                    raise serializers.ValidationError(
                        f"Тег '{tag.name}' не принадлежит данному eventum"
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
        children = obj.children.all()
        return LocationSerializer(children, many=True).data
    
    
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


# Добавляем поле location в EventSerializer после определения LocationSerializer
class EventWithLocationSerializer(EventSerializer):
    location = LocationSerializer(read_only=True)
    
    class Meta(EventSerializer.Meta):
        fields = EventSerializer.Meta.fields + ['location']


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
