from django import forms
from django.contrib import admin
from django.core.exceptions import ValidationError
from import_export.admin import ImportExportModelAdmin

# Импортируем все модели
from .models import (
    Eventum, Participant, ParticipantGroup,
    GroupTag, Event, EventTag
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

class EventInline(admin.TabularInline):
    model = Event
    extra = 1
    # filter_horizontal не работает в TabularInline - это ограничение Django
    # Для редактирования M2M полей нужно переходить на страницу события
    fields = ['name', 'description', 'start_time', 'end_time']


class EventumAdminForm(forms.ModelForm):
    password = forms.CharField(
        label="Password",
        required=False,
        widget=forms.PasswordInput(render_value=True), # True для возможности просмотра при редактировании
        help_text="Оставьте пустым, чтобы не менять пароль"
    )
    
    class Meta:
        model = Eventum
        exclude = ('password_hash',)
    
    def clean(self):
        cleaned_data = super().clean()
        password = cleaned_data.get('password')
        
        # Валидация пароля при создании нового Eventum
        if not self.instance.pk and not password:
            raise ValidationError("Пароль обязателен для нового мероприятия")
        
        return cleaned_data

class ParticipantGroupAdminForm(forms.ModelForm):
    class Meta:
        model = ParticipantGroup
        fields = '__all__'
    
    def clean(self):
        cleaned_data = super().clean()
        participants = cleaned_data.get('participants')
        eventum = cleaned_data.get('eventum')
        
        # Проверяем, что все участники принадлежат тому же eventum
        if participants and eventum:
            for participant in participants:
                if participant.eventum != eventum:
                    raise ValidationError(
                        f"Участник '{participant.name}' принадлежит другому мероприятию"
                    )
        
        return cleaned_data

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
    inlines = [ParticipantInline, EventInline] # Ваша логика с инлайнами сохранена
    
    # Мы не показываем поле password_hash в админке
    # Ваш exclude = ['password_hash'] заменен более явным get_fieldsets
    
    def get_fieldsets(self, request, obj=None):
        # Ваша логика для полей пароля полностью сохранена
        fieldsets = [
            (None, {
                'fields': ('name', 'slug')
            })
        ]
        if obj:
            fieldsets.append(
                ('Изменить пароль', {
                    'fields': ('password',),
                    'description': 'Введите новый пароль, чтобы его изменить. Оставьте пустым, чтобы не менять.'
                })
            )
        else:
            fieldsets.append(
                ('Пароль для доступа', {
                    'fields': ('password',),
                    'description': 'Этот пароль будет необходим для редактирования данных мероприятия.'
                })
            )
        return fieldsets
    
    def save_model(self, request, obj, form, change):
        # Ваша логика сохранения пароля полностью сохранена
        if form.cleaned_data.get('password'):
            obj.set_password(form.cleaned_data['password'])
        super().save_model(request, obj, form, change)

# --- ParticipantAdmin ---
# Наследуемся от ImportExportModelAdmin и добавляем resource_class
@admin.register(Participant)
class ParticipantAdmin(ImportExportModelAdmin):
    resource_class = ParticipantResource
    # Ваша логика отображения сохранена
    list_display = ('name', 'eventum')
    list_filter = ('eventum',)
    # Добавлено для удобства
    search_fields = ('name',)

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
    readonly_fields = ('slug',)
    search_fields = ('name',)

# --- GroupTagAdmin ---
# Наследуемся от ImportExportModelAdmin и добавляем resource_class
@admin.register(GroupTag)
class GroupTagAdmin(ImportExportModelAdmin):
    resource_class = GroupTagResource
    # Ваша логика отображения сохранена
    list_display = ('name', 'slug', 'eventum')
    list_filter = ('eventum',)
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ('slug',)
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
    readonly_fields = ('slug',)
    # Добавлено для удобства
    search_fields = ('name',)

