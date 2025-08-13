# your_app/resources.py

from import_export import resources, fields
from import_export.widgets import ForeignKeyWidget, ManyToManyWidget, DateTimeWidget
from .models import Eventum, Participant, GroupTag, ParticipantGroup, EventTag, Event

# --- Ресурс для участников ---
class ParticipantResource(resources.ModelResource):
    # Мы говорим, что поле 'eventum' в нашем CSV/XLS будет содержать 'slug'
    # соответствующего Eventum, и библиотека должна найти объект Eventum по этому slug.
    eventum = fields.Field(
        column_name='eventum',
        attribute='eventum',
        widget=ForeignKeyWidget(Eventum, 'slug'))

    class Meta:
        model = Participant
        # 'id' нужен, чтобы другие ресурсы (Group, Event) могли ссылаться на участников.
        fields = ('id', 'name', 'eventum')
        import_id_fields = ('id',) # Используем 'id' как уникальный идентификатор при импорте.


# --- Ресурс для тегов групп ---
class GroupTagResource(resources.ModelResource):
    eventum = fields.Field(
        column_name='eventum',
        attribute='eventum',
        widget=ForeignKeyWidget(Eventum, 'slug'))
        
    class Meta:
        model = GroupTag
        fields = ('id', 'name', 'slug', 'eventum')
        import_id_fields = ('id',)


# --- Ресурс для тегов событий ---
class EventTagResource(resources.ModelResource):
    eventum = fields.Field(
        column_name='eventum',
        attribute='eventum',
        widget=ForeignKeyWidget(Eventum, 'slug'))
        
    class Meta:
        model = EventTag
        fields = ('id', 'name', 'slug', 'eventum')
        import_id_fields = ('id',)


# --- Ресурс для групп участников ---
class ParticipantGroupResource(resources.ModelResource):
    eventum = fields.Field(
        column_name='eventum',
        attribute='eventum',
        widget=ForeignKeyWidget(Eventum, 'slug'))
    
    # Для ManyToMany полей, мы говорим, что в CSV будет список ID через запятую (например, "1,2,3")
    participants = fields.Field(
        column_name='participants',
        attribute='participants',
        widget=ManyToManyWidget(Participant, field='id'))

    tags = fields.Field(
        column_name='tags',
        attribute='tags',
        widget=ManyToManyWidget(GroupTag, field='id'))

    class Meta:
        model = ParticipantGroup
        fields = ('id', 'name', 'slug', 'eventum', 'participants', 'tags')
        import_id_fields = ('id',)


# --- Ресурс для Событий (Events) ---
class EventResource(resources.ModelResource):
    eventum = fields.Field(
        column_name='eventum',
        attribute='eventum',
        widget=ForeignKeyWidget(Eventum, 'slug'))

    participants = fields.Field(
        column_name='participants',
        attribute='participants',
        widget=ManyToManyWidget(Participant, field='id'))

    groups = fields.Field(
        column_name='groups',
        attribute='groups',
        widget=ManyToManyWidget(ParticipantGroup, field='id'))

    tags = fields.Field(
        column_name='tags',
        attribute='tags',
        widget=ManyToManyWidget(EventTag, field='id'))

    start_time = fields.Field(
        column_name='start_time',
        attribute='start_time',
        widget=DateTimeWidget(format='%Y-%m-%dT%H:%M:%SZ'))

    end_time = fields.Field(
        column_name='end_time',
        attribute='end_time',
        widget=DateTimeWidget(format='%Y-%m-%dT%H:%M:%SZ'))

    class Meta:
        model = Event
        fields = ('id', 'name', 'description', 'start_time', 'end_time', 'eventum', 'participants', 'groups', 'tags')
        import_id_fields = ('id',)
