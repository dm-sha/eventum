from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0039_eventum_groups_tab_visible'),
    ]

    operations = [
        migrations.AddField(
            model_name='eventwave',
            name='allow_multiple_button_registrations',
            field=models.BooleanField(
                default=False,
                help_text='Если включено, участник может записаться по кнопке на несколько мероприятий в этой волне одновременно. Иначе — не более одного мероприятия с типом «Запись по кнопке» в волне.',
            ),
        ),
    ]
