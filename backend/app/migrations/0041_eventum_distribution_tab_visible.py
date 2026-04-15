from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("app", "0040_eventwave_allow_multiple_button_registrations"),
    ]

    operations = [
        migrations.AddField(
            model_name="eventum",
            name="distribution_tab_visible",
            field=models.BooleanField(
                default=False,
                help_text="Показывать ли вкладку «Распределение» на странице события участникам",
            ),
        ),
    ]
