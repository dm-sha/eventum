from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0029_eventregistrationapplication'),
    ]

    operations = [
        migrations.AddField(
            model_name='eventum',
            name='schedule_visible',
            field=models.BooleanField(default=True, help_text='Отображать ли вкладку расписания участникам'),
        ),
    ]


