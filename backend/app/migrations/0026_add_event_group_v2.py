from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0025_migrate_to_participant_groups_v2'),
    ]

    operations = [
        migrations.AddField(
            model_name='event',
            name='event_group_v2',
            field=models.OneToOneField(blank=True, help_text='Опциональная связь 1:1 с группой V2', null=True, on_delete=models.SET_NULL, related_name='linked_event', to='app.participantgroupv2'),
        ),
    ]


