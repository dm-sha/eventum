from django.contrib import admin
from .models import *

class ParticipantInline(admin.TabularInline):
    model = Participant
    extra = 1

class GroupInline(admin.TabularInline):
    model = Group
    extra = 1

class EventInline(admin.TabularInline):
    model = Event
    extra = 1

@admin.register(Eventum)
class EventumAdmin(admin.ModelAdmin):
    inlines = [ParticipantInline, GroupInline, EventInline]

@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    filter_horizontal = ['participants', 'tags']
    list_filter = ['eventum']

@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    filter_horizontal = ['participants', 'groups', 'tags']
    list_filter = ['eventum']

@admin.register(GroupTag)
class GroupTagAdmin(admin.ModelAdmin):
    list_filter = ['eventum']

@admin.register(EventTag)
class EventTagAdmin(admin.ModelAdmin):
    list_filter = ['eventum']
