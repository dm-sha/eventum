# Синхронизация графа миграций (V2 → имена без V2) только в state; в PostgreSQL — только новые колонки.
# Таблицы app_participantgroup* уже созданы/переименованы в 0024 + 0035, поэтому CreateModel на БД нельзя.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0036_rename_event_group_v2_column'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql="""
                        ALTER TABLE app_participantgroup
                            ADD COLUMN IF NOT EXISTS visible_to_participants boolean NOT NULL DEFAULT false;
                        ALTER TABLE app_participantgroup
                            ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
                        CREATE INDEX IF NOT EXISTS app_partici_visible_e70767_idx
                            ON app_participantgroup (visible_to_participants);
                    """,
                    reverse_sql="""
                        DROP INDEX IF EXISTS app_partici_visible_e70767_idx;
                        ALTER TABLE app_participantgroup DROP COLUMN IF EXISTS description;
                        ALTER TABLE app_participantgroup DROP COLUMN IF EXISTS visible_to_participants;
                    """,
                ),
            ],
            state_operations=[
                migrations.CreateModel(
                    name='ParticipantGroup',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('name', models.CharField(max_length=200)),
                        ('is_event_group', models.BooleanField(default=False, help_text='Если True, группа используется для связи с событиями и не показывается в основном интерфейсе')),
                        ('visible_to_participants', models.BooleanField(default=False, help_text='Если True, группа может отображаться участникам на странице события (при включении организатором)')),
                        ('description', models.TextField(blank=True, default='')),
                    ],
                    options={
                        'verbose_name': 'Participant Group',
                        'verbose_name_plural': 'Participant Groups',
                    },
                ),
                migrations.CreateModel(
                    name='ParticipantGroupEventRelation',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                    ],
                    options={
                        'verbose_name': 'Participant Group Event Relation',
                        'verbose_name_plural': 'Participant Group Event Relations',
                    },
                ),
                migrations.CreateModel(
                    name='ParticipantGroupParticipantRelation',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('relation_type', models.CharField(choices=[('inclusive', 'Включает (участник входит в группу)'), ('exclusive', 'Исключает (участник НЕ входит в группу)')], default='inclusive', max_length=20)),
                    ],
                    options={
                        'verbose_name': 'Participant Group Participant Relation',
                        'verbose_name_plural': 'Participant Group Participant Relations',
                    },
                ),
                migrations.RemoveField(
                    model_name='participantgroupv2',
                    name='eventum',
                ),
                migrations.RemoveField(
                    model_name='participantgroupv2participantrelation',
                    name='group',
                ),
                migrations.RemoveField(
                    model_name='event',
                    name='event_group_v2',
                ),
                migrations.RemoveField(
                    model_name='participantgroupv2eventrelation',
                    name='group',
                ),
                migrations.AlterUniqueTogether(
                    name='participantgroupv2eventrelation',
                    unique_together=None,
                ),
                migrations.RemoveField(
                    model_name='participantgroupv2eventrelation',
                    name='event',
                ),
                migrations.AlterUniqueTogether(
                    name='participantgroupv2participantrelation',
                    unique_together=None,
                ),
                migrations.RemoveField(
                    model_name='participantgroupv2participantrelation',
                    name='participant',
                ),
                # В state модель ещё participantgroupv2grouprelation — сначала RenameModel, потом опции/индексы.
                migrations.RenameModel(
                    old_name='ParticipantGroupV2GroupRelation',
                    new_name='ParticipantGroupGroupRelation',
                ),
                migrations.AlterModelOptions(
                    name='participantgroupgrouprelation',
                    options={'verbose_name': 'Participant Group Group Relation', 'verbose_name_plural': 'Participant Group Group Relations'},
                ),
                migrations.RenameIndex(
                    model_name='participantgroupgrouprelation',
                    new_name='app_partici_group_i_569bb6_idx',
                    old_name='app_partici_group_i_02d75f_idx',
                ),
                migrations.RenameIndex(
                    model_name='participantgroupgrouprelation',
                    new_name='app_partici_target__f7ee2f_idx',
                    old_name='app_partici_target__7c99f1_idx',
                ),
                migrations.AddField(
                    model_name='participantgroup',
                    name='eventum',
                    field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='participant_groups', to='app.eventum'),
                ),
                migrations.AddField(
                    model_name='event',
                    name='event_group',
                    field=models.OneToOneField(blank=True, help_text='Опциональная связь 1:1 с группой', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='linked_event', to='app.participantgroup'),
                ),
                migrations.AlterField(
                    model_name='eventregistration',
                    name='allowed_group',
                    field=models.ForeignKey(blank=True, help_text='Группа участников, которым доступна запись на это мероприятие. Если не указана, доступна всем участникам eventum.', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='event_registrations', to='app.participantgroup'),
                ),
                migrations.AlterField(
                    model_name='participantgroupgrouprelation',
                    name='group',
                    field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='group_relations', to='app.participantgroup'),
                ),
                migrations.AlterField(
                    model_name='participantgroupgrouprelation',
                    name='target_group',
                    field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='source_relations', to='app.participantgroup'),
                ),
                migrations.AddField(
                    model_name='participantgroupeventrelation',
                    name='event',
                    field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='group_relations', to='app.event'),
                ),
                migrations.AddField(
                    model_name='participantgroupeventrelation',
                    name='group',
                    field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='event_relations', to='app.participantgroup'),
                ),
                migrations.AddField(
                    model_name='participantgroupparticipantrelation',
                    name='group',
                    field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='participant_relations', to='app.participantgroup'),
                ),
                migrations.AddField(
                    model_name='participantgroupparticipantrelation',
                    name='participant',
                    field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='group_relations', to='app.participant'),
                ),
                migrations.DeleteModel(
                    name='ParticipantGroupV2EventRelation',
                ),
                migrations.DeleteModel(
                    name='ParticipantGroupV2ParticipantRelation',
                ),
                migrations.AddIndex(
                    model_name='participantgroup',
                    index=models.Index(fields=['eventum'], name='app_partici_eventum_dde549_idx'),
                ),
                migrations.AddIndex(
                    model_name='participantgroup',
                    index=models.Index(fields=['is_event_group'], name='app_partici_is_even_104ff2_idx'),
                ),
                migrations.AddIndex(
                    model_name='participantgroup',
                    index=models.Index(fields=['visible_to_participants'], name='app_partici_visible_e70767_idx'),
                ),
                migrations.DeleteModel(
                    name='ParticipantGroupV2',
                ),
                migrations.AddIndex(
                    model_name='participantgroupeventrelation',
                    index=models.Index(fields=['group'], name='app_partici_group_i_3781c4_idx'),
                ),
                migrations.AddIndex(
                    model_name='participantgroupeventrelation',
                    index=models.Index(fields=['event'], name='app_partici_event_i_82ae20_idx'),
                ),
                migrations.AlterUniqueTogether(
                    name='participantgroupeventrelation',
                    unique_together={('group', 'event')},
                ),
                migrations.AddIndex(
                    model_name='participantgroupparticipantrelation',
                    index=models.Index(fields=['group'], name='app_partici_group_i_f6f033_idx'),
                ),
                migrations.AddIndex(
                    model_name='participantgroupparticipantrelation',
                    index=models.Index(fields=['participant'], name='app_partici_partici_349a20_idx'),
                ),
                migrations.AlterUniqueTogether(
                    name='participantgroupparticipantrelation',
                    unique_together={('group', 'participant')},
                ),
            ],
        ),
    ]
