from django.db import models

class Participant(models.Model):
    name = models.CharField(max_length=100, verbose_name="Participant Name")
    
    def __str__(self):
        return self.name
    
    class Meta:
        verbose_name = "Participant"
        verbose_name_plural = "Participants"

class Event(models.Model):
    title = models.CharField(max_length=200, verbose_name="Event Title")
    start_date = models.DateTimeField(verbose_name="Start Date")
    end_date = models.DateTimeField(verbose_name="End Date")
    participants = models.ManyToManyField(
        Participant, 
        related_name='events',
        blank=True,
        verbose_name="Participants"
    )
    
    def __str__(self):
        return f"{self.title} ({self.start_date.date()} - {self.end_date.date()})"
    
    class Meta:
        verbose_name = "Event"
        verbose_name_plural = "Events"
        ordering = ['start_date']
