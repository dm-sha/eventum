from django import forms
from django.contrib import admin
from import_export.admin import ImportExportModelAdmin

# Импортируем все модели
from .models import (
    Eventum,
    EventumMembership,
    EventTag,
    GroupTag,
    Participant,
    ParticipantGroup,
    UserProfile,
    Event,
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
    # Важно: filter_horizontal в инлайнах может не работать идеально,
    # это известное ограничение Django. Для полноценного редактирования M2M
    # лучше переходить на страницу самого события.
    # Но мы оставляем вашу логику здесь.
    filter_horizontal = ['participants', 'groups', 'tags']


class EventumAdminForm(forms.ModelForm):
    password = forms.CharField(
        label="Password",
        required=False,
        widget=forms.PasswordInput(render_value=False), # Изменено на False для безопасности
        help_text="Оставьте пустым, чтобы не менять пароль"
    )
    
    class Meta:
        model = Eventum
        exclude = ('password_hash',)

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
    resource_class = EventResource
    # Вся ваша логика отображения и фильтров сохранена
    list_display = ('name', 'start_time', 'end_time', 'eventum')
    list_filter = ('eventum', 'start_time', 'tags') # Добавил 'tags' для удобства
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


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'organization', 'phone', 'created_at')
    search_fields = ('user__username', 'user__email', 'organization')


@admin.register(EventumMembership)
class EventumMembershipAdmin(admin.ModelAdmin):
    list_display = ('user', 'eventum', 'role', 'created_at')
    list_filter = ('role', 'eventum')
    search_fields = ('user__username', 'user__email', 'eventum__name', 'eventum__slug')
