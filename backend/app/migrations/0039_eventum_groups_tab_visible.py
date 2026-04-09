from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("app", "0038_add_public_page_to_eventum"),
    ]

    operations = [
        migrations.AddField(
            model_name="eventum",
            name="groups_tab_visible",
            field=models.BooleanField(
                default=False,
                help_text="Показывать ли вкладку «Группы участников» на странице события для участников",
            ),
        ),
    ]
