from django.contrib import admin
from .models import Event, Participant

class ParticipantAdmin(admin.ModelAdmin):
    list_display = ('name',)
    search_fields = ('name',)

class EventAdmin(admin.ModelAdmin):
    list_display = ('title', 'start_date', 'end_date')
    list_filter = ('start_date', 'end_date')
    search_fields = ('title', 'participants__name')
    filter_horizontal = ('participants',)
    date_hierarchy = 'start_date'

admin.site.register(Participant, ParticipantAdmin)
admin.site.register(Event, EventAdmin)
