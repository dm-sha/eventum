from django.db import models
from django.core.exceptions import ValidationError

class Eventum(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    password = models.CharField(max_length=255)

    def __str__(self):
        return self.name

class Participant(models.Model):
    name = models.CharField(max_length=255)
    eventum = models.ForeignKey(Eventum, on_delete=models.CASCADE)

    def __str__(self):
        return self.name

class Group(models.Model):
    name = models.CharField(max_length=255)
    eventum = models.ForeignKey(Eventum, on_delete=models.CASCADE)
    participants = models.ManyToManyField(Participant, blank=True)
    tags = models.ManyToManyField('GroupTag', blank=True)

    def clean(self):
        super().clean()
        participants_eventum = self.participants.values_list('eventum', flat=True).distinct()
        if participants_eventum and any(e != self.eventum_id for e in participants_eventum):
            raise ValidationError("All participants must belong to the same Eventum")

    def __str__(self):
        return self.name

class GroupTag(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField()
    eventum = models.ForeignKey(Eventum, on_delete=models.CASCADE)

    class Meta:
        unique_together = ('slug', 'eventum')

    def __str__(self):
        return self.name

class Event(models.Model):
    eventum = models.ForeignKey(Eventum, on_delete=models.CASCADE)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    participants = models.ManyToManyField(Participant, blank=True)
    groups = models.ManyToManyField(Group, blank=True)
    tags = models.ManyToManyField('EventTag', blank=True)

    def __str__(self):
        return f"{self.start_time} - {self.end_time}"

class EventTag(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField()
    eventum = models.ForeignKey(Eventum, on_delete=models.CASCADE)

    class Meta:
        unique_together = ('slug', 'eventum')

    def __str__(self):
        return self.name
