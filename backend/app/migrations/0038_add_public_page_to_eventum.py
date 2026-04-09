from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0037_participantgroup_participantgroupeventrelation_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='eventum',
            name='public_page',
            field=models.BooleanField(
                default=False,
                help_text='Показывать страницу события (вкладка «Общее») без входа в аккаунт',
            ),
        ),
    ]
