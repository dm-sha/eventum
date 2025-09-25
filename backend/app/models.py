from django.db import models
from django.core.exceptions import ValidationError
from django.utils.text import slugify
from django.utils import timezone

class Eventum(models.Model):
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True)
    
    def __str__(self):
        return self.name

class Participant(models.Model):
    eventum = models.ForeignKey(Eventum, on_delete=models.CASCADE, related_name='participants')
    name = models.CharField(max_length=200)
    
    def __str__(self):
        return f"{self.name} ({self.eventum.name})"

class GroupTag(models.Model):
    eventum = models.ForeignKey(Eventum, on_delete=models.CASCADE, related_name='group_tags')
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100)
    
    class Meta:
        unique_together = ('eventum', 'slug')
    
    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        self.full_clean()
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.name} ({self.eventum.name})"

class ParticipantGroup(models.Model):
    eventum = models.ForeignKey(Eventum, on_delete=models.CASCADE, related_name='participant_groups')
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200)
    participants = models.ManyToManyField(Participant, related_name='groups')
    tags = models.ManyToManyField(GroupTag, related_name='groups', blank=True)
    
    class Meta:
        unique_together = ('eventum', 'slug')
    
    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        self.full_clean()
        super().save(*args, **kwargs)
    
    def clean(self):
        # Ensure all participants belong to the same eventum
        for participant in self.participants.all():
            if participant.eventum != self.eventum:
                raise ValidationError(
                    f"Participant {participant.name} belongs to a different eventum"
                )
    
    def __str__(self):
        return f"{self.name} ({self.eventum.name})"

class EventTag(models.Model):
    eventum = models.ForeignKey(Eventum, on_delete=models.CASCADE, related_name='event_tags')
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100)

    class Meta:
        unique_together = ('eventum', 'slug')

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.eventum.name})"

class Event(models.Model):
    eventum = models.ForeignKey(Eventum, on_delete=models.CASCADE, related_name='events')
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    participants = models.ManyToManyField(
        Participant, 
        related_name='individual_events',
        blank=True
    )
    groups = models.ManyToManyField(
        ParticipantGroup, 
        related_name='events',
        blank=True
    )
    tags = models.ManyToManyField(EventTag, related_name='events', blank=True)
    
    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
    
    def clean(self):
        # Ensure end time is after start time
        if self.end_time <= self.start_time:
            raise ValidationError("End time must be after start time")
        
        # Ensure all participants belong to the same eventum
        for participant in self.participants.all():
            if participant.eventum != self.eventum:
                raise ValidationError(
                    f"Participant {participant.name} belongs to a different eventum"
                )
        
        # Ensure all groups belong to the same eventum
        for group in self.groups.all():
            if group.eventum != self.eventum:
                raise ValidationError(
                    f"Group {group.name} belongs to a different eventum"
                )
    
    def __str__(self):
        return f"{self.name} ({self.eventum.name})"
