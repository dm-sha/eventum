from django import forms
from django.contrib import admin
from django.core.exceptions import ValidationError
from django.utils.html import format_html
from import_export.admin import ImportExportModelAdmin

# Импортируем все модели
from .models import (
    Eventum, Participant, ParticipantGroup,
    GroupTag, Event, EventTag, UserProfile, UserRole, Location,
    EventRegistration, ParticipantGroupV2
)

# Импортируем все ресурсы, которые мы определили в resources.py
from .resources import (
    ParticipantResource,
    GroupTagResource,
    EventTagResource,
    ParticipantGroupResource,
    EventResource
)

# --- ЭТИ КЛАССЫ ОСТАЮТСЯ БЕЗ ИЗМЕНЕНИЙ, ТАК КАК ОНИ ИСПОЛЬЗУЮТСЯ В EventumAdmin ---

class ParticipantInline(admin.TabularInline):
    model = Participant
    extra = 1
    fields = ['user', 'name']
    autocomplete_fields = ['user']

class UserParticipantInline(admin.TabularInline):
    model = Participant
    extra = 0
    fields = ['eventum', 'name']
    readonly_fields = ['name']
    fk_name = 'user'
    
    def has_add_permission(self, request, obj=None):
        # Не разрешаем добавлять участников через профиль пользователя
        return False

class EventInline(admin.TabularInline):
    model = Event
    extra = 1
    # filter_horizontal не работает в TabularInline - это ограничение Django
    # Для редактирования M2M полей нужно переходить на страницу события
    fields = ['name', 'description', 'start_time', 'end_time']

class LocationInline(admin.TabularInline):
    model = Location
    extra = 1
    fields = ['name', 'kind', 'parent', 'address', 'floor']
    fk_name = 'parent'


class EventumAdminForm(forms.ModelForm):
    class Meta:
        model = Eventum
        fields = '__all__'
        widgets = {
            'image_url': forms.URLInput(attrs={'placeholder': 'https://example.com/image.jpg'}),
        }

class ParticipantAdminForm(forms.ModelForm):
    class Meta:
        model = Participant
        fields = '__all__'

class ParticipantGroupAdminForm(forms.ModelForm):
    class Meta:
        model = ParticipantGroup
        fields = '__all__'
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Делаем slug только для чтения, если объект уже существует
        if self.instance and self.instance.pk:
            self.fields['slug'].widget.attrs['readonly'] = True
            self.fields['slug'].help_text = 'Slug автоматически генерируется из названия'
    
    def clean(self):
        cleaned_data = super().clean()
        participants = cleaned_data.get('participants')
        eventum = cleaned_data.get('eventum')
        
        # Проверяем, что все участники принадлежат тому же eventum
        if participants and eventum:
            invalid_participants = [p for p in participants if p.eventum != eventum]
            if invalid_participants:
                invalid_names = [p.name for p in invalid_participants]
                raise ValidationError(
                    f"Участники {', '.join(invalid_names)} принадлежат другому мероприятию"
                )
        
        return cleaned_data

class GroupTagAdminForm(forms.ModelForm):
    class Meta:
        model = GroupTag
        fields = '__all__'
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Делаем slug только для чтения, если объект уже существует
        if self.instance and self.instance.pk:
            self.fields['slug'].widget.attrs['readonly'] = True
            self.fields['slug'].help_text = 'Slug автоматически генерируется из названия'

class EventAdminForm(forms.ModelForm):
    class Meta:
        model = Event
        fields = '__all__'
    
    def clean(self):
        cleaned_data = super().clean()
        participants = cleaned_data.get('participants')
        groups = cleaned_data.get('groups')
        eventum = cleaned_data.get('eventum')
        
        # Проверяем участников
        if participants and eventum:
            for participant in participants:
                if participant.eventum != eventum:
                    raise ValidationError(
                        f"Участник '{participant.name}' принадлежит другому мероприятию"
                    )
        
        # Проверяем группы
        if groups and eventum:
            for group in groups:
                if group.eventum != eventum:
                    raise ValidationError(
                        f"Группа '{group.name}' принадлежит другому мероприятию"
                    )
        
        return cleaned_data

class LocationAdminForm(forms.ModelForm):
    class Meta:
        model = Location
        fields = '__all__'
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Делаем slug только для чтения, если объект уже существует
        if self.instance and self.instance.pk:
            self.fields['slug'].widget.attrs['readonly'] = True
            self.fields['slug'].help_text = 'Slug автоматически генерируется из названия'
    
    def clean(self):
        cleaned_data = super().clean()
        parent = cleaned_data.get('parent')
        eventum = cleaned_data.get('eventum')
        
        # Проверяем, что родительская локация принадлежит тому же eventum
        if parent and eventum and parent.eventum != eventum:
            raise ValidationError(
                "Родительская локация должна принадлежать тому же мероприятию"
            )
        
        return cleaned_data

# --- EventumAdmin ---
# Упрощенная версия без inline-компонентов для избежания таймаутов
@admin.register(Eventum)
class EventumAdmin(admin.ModelAdmin):
    form = EventumAdminForm
    list_display = ('name', 'slug', 'has_image', 'participants_count', 'events_count')
    prepopulated_fields = {'slug': ('name',)}
    # Убираем inlines для избежания таймаутов
    search_fields = ('name', 'slug')
    fields = ('name', 'slug', 'description', 'image_url', 'image_preview')
    readonly_fields = ('image_preview', 'participants_count', 'events_count')
    
    def has_image(self, obj):
        """Показывает, есть ли изображение у eventum"""
        return bool(obj.image_url)
    has_image.boolean = True
    has_image.short_description = 'Есть изображение'
    
    def image_preview(self, obj):
        """Показывает превью изображения в админке"""
        if obj.image_url:
            return format_html(
                '<img src="{}" style="max-width: 200px; max-height: 150px; border-radius: 8px;" />',
                obj.image_url
            )
        return "Нет изображения"
    image_preview.short_description = 'Превью изображения'
    
    def participants_count(self, obj):
        """Показывает количество участников"""
        if obj.pk:
            return obj.participants.count()
        return 0
    participants_count.short_description = 'Участников'
    
    def events_count(self, obj):
        """Показывает количество событий"""
        if obj.pk:
            return obj.events.count()
        return 0
    events_count.short_description = 'Событий'

# --- ParticipantAdmin ---
@admin.register(Participant)
class ParticipantAdmin(ImportExportModelAdmin):
    resource_class = ParticipantResource
    list_display = ('name', 'user', 'eventum')
    list_filter = ('eventum',)
    search_fields = ('name', 'user__name', 'user__vk_id')
    autocomplete_fields = ('user',)

# --- ParticipantGroupAdmin ---
# Упрощенная версия для лучшей производительности
@admin.register(ParticipantGroup)
class ParticipantGroupAdmin(ImportExportModelAdmin):
    form = ParticipantGroupAdminForm
    resource_class = ParticipantGroupResource
    list_display = ('name', 'slug', 'eventum', 'participants_count')
    list_filter = ('eventum',)
    # Убираем filter_horizontal для больших M2M полей
    autocomplete_fields = ['eventum']
    prepopulated_fields = {'slug': ('name',)}
    search_fields = ('name',)
    readonly_fields = ('participants_count',)
    
    def participants_count(self, obj):
        """Показывает количество участников в группе"""
        if obj.pk:
            return obj.participants.count()
        return 0
    participants_count.short_description = 'Участников в группе'

# --- GroupTagAdmin ---
# Наследуемся от ImportExportModelAdmin и добавляем resource_class
@admin.register(GroupTag)
class GroupTagAdmin(ImportExportModelAdmin):
    form = GroupTagAdminForm
    resource_class = GroupTagResource
    # Ваша логика отображения сохранена
    list_display = ('name', 'slug', 'eventum')
    list_filter = ('eventum',)
    prepopulated_fields = {'slug': ('name',)}
    # Добавлено для удобства
    search_fields = ('name',)

# --- EventAdmin ---
# Упрощенная версия для лучшей производительности
@admin.register(Event)
class EventAdmin(ImportExportModelAdmin):
    form = EventAdminForm
    resource_class = EventResource
    list_display = ('name', 'start_time', 'end_time', 'eventum', 'participant_type')
    list_filter = ('eventum', 'participant_type', 'start_time')
    # Убираем filter_horizontal для больших M2M полей - они могут вызывать таймауты
    # Вместо этого используем autocomplete_fields для более эффективного поиска
    autocomplete_fields = ['eventum']
    search_fields = ('name', 'description')
    fields = ('eventum', 'name', 'description', 'start_time', 'end_time', 
              'participant_type', 'max_participants', 'image_url')

# --- EventTagAdmin ---
# Наследуемся от ImportExportModelAdmin и добавляем resource_class
@admin.register(EventTag)
class EventTagAdmin(ImportExportModelAdmin):
    resource_class = EventTagResource
    # Ваша логика отображения сохранена
    list_display = ('name', 'slug', 'eventum')
    list_filter = ('eventum',)
    prepopulated_fields = {'slug': ('name',)}
    # Добавлено для удобства
    search_fields = ('name',)


# --- UserProfileAdmin ---
@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('vk_id', 'name', 'email', 'date_joined', 'last_login')
    list_filter = ('date_joined', 'last_login')
    search_fields = ('vk_id', 'name', 'email')
    readonly_fields = ('vk_id', 'date_joined', 'last_login')
    inlines = [UserParticipantInline]


# --- LocationAdmin ---
# Упрощенная версия без inline для лучшей производительности
@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    form = LocationAdminForm
    list_display = ('name', 'kind', 'parent', 'eventum', 'address', 'floor')
    list_filter = ('kind', 'eventum')
    search_fields = ('name', 'address', 'notes')
    prepopulated_fields = {'slug': ('name',)}
    autocomplete_fields = ('parent', 'eventum')
    # Убираем inlines для избежания таймаутов
    fields = ('eventum', 'parent', 'name', 'slug', 'kind', 'address', 'floor', 'notes')
    
    def get_queryset(self, request):
        """Оптимизируем запросы для админки"""
        return super().get_queryset(request).select_related('eventum', 'parent')


# --- UserRoleAdmin ---
@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    list_display = ('user', 'eventum', 'role', 'created_at')
    list_filter = ('role', 'created_at', 'eventum')
    search_fields = ('user__name', 'user__vk_id', 'eventum__name')
    readonly_fields = ('created_at',)
    autocomplete_fields = ('user', 'eventum')


# --- ParticipantGroupV2Admin ---
@admin.register(ParticipantGroupV2)
class ParticipantGroupV2Admin(admin.ModelAdmin):
    list_display = ('name', 'eventum', 'is_event_group')
    list_filter = ('eventum', 'is_event_group')
    search_fields = ('name', 'eventum__name')
    autocomplete_fields = ('eventum',)


# --- EventRegistrationAdmin ---
@admin.register(EventRegistration)
class EventRegistrationAdmin(admin.ModelAdmin):
    list_display = ('event', 'registration_type', 'max_participants', 'allowed_group', 'registered_count')
    list_filter = ('registration_type', 'event__eventum')
    search_fields = ('event__name',)
    autocomplete_fields = ('event', 'allowed_group')
    filter_horizontal = ('applicants',)
    fields = ('event', 'registration_type', 'max_participants', 'allowed_group', 'applicants')
    
    def registered_count(self, obj):
        """Показывает количество зарегистрированных участников"""
        if obj.pk:
            return obj.get_registered_count()
        return 0
    registered_count.short_description = 'Зарегистрировано'

