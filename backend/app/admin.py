from django import forms
from django.contrib import admin
from django.core.exceptions import ValidationError
from import_export.admin import ImportExportModelAdmin

# Импортируем все модели
from .models import (
    Eventum, Participant, ParticipantGroup,
    GroupTag, Event, EventTag, UserProfile, UserRole
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


class EventumAdminForm(forms.ModelForm):
    class Meta:
        model = Eventum
        fields = '__all__'

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

# --- EventumAdmin ---
# Мы НЕ делаем его ImportExportModelAdmin, так как это корневая сущность,
# которую логично создавать вручную. Вся ваша кастомная логика здесь сохранена.
@admin.register(Eventum)
class EventumAdmin(admin.ModelAdmin):
    form = EventumAdminForm
    list_display = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}
    inlines = [ParticipantInline, EventInline]
    search_fields = ('name', 'slug')

# --- ParticipantAdmin ---
@admin.register(Participant)
class ParticipantAdmin(ImportExportModelAdmin):
    resource_class = ParticipantResource
    list_display = ('name', 'user', 'eventum')
    list_filter = ('eventum',)
    search_fields = ('name', 'user__name', 'user__vk_id')
    autocomplete_fields = ('user',)

# --- ParticipantGroupAdmin ---
# Наследуемся от ImportExportModelAdmin и добавляем resource_class
@admin.register(ParticipantGroup)
class ParticipantGroupAdmin(ImportExportModelAdmin):
    form = ParticipantGroupAdminForm
    resource_class = ParticipantGroupResource
    # Вся ваша логика отображения и фильтров сохранена
    list_display = ('name', 'slug', 'eventum')
    list_filter = ('eventum',)
    filter_horizontal = ['participants', 'tags']
    # Добавлено для удобства
    prepopulated_fields = {'slug': ('name',)}
    search_fields = ('name',)

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
# Наследуемся от ImportExportModelAdmin и добавляем resource_class
@admin.register(Event)
class EventAdmin(ImportExportModelAdmin):
    form = EventAdminForm
    resource_class = EventResource
    # Вся ваша логика отображения и фильтров сохранена
    list_display = ('name', 'start_time', 'end_time', 'eventum')
    list_filter = ('eventum', 'start_time') # Убрал 'tags' - может быть медленно для M2M
    filter_horizontal = ['participants', 'groups', 'tags']
    # Добавлено для удобства
    search_fields = ('name', 'description')

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


# --- UserRoleAdmin ---
@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    list_display = ('user', 'eventum', 'role', 'created_at')
    list_filter = ('role', 'created_at', 'eventum')
    search_fields = ('user__name', 'user__vk_id', 'eventum__name')
    readonly_fields = ('created_at',)
    autocomplete_fields = ('user', 'eventum')

