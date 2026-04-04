"""
Импорт участников в eventum из CSV.

Формат строки: ФИО,Название группы,ссылка VK

Поддерживаемые ссылки: vk.com/id123, https://vk.ru/nickname, vk.com/nickname и т.п.
Для ников (без id…) нужен сервисный ключ в переменной окружения VK_SERVICE_ACCESS_TOKEN
(настройки приложения VK → «Сервисный ключ доступа»).

Группа участников определяется парой (eventum, точное имя группы из CSV, не event_group).
Если такая группа уже есть (создана ранее или в предыдущей строке импорта), новая
не создаётся — все подходящие участники связываются с одной и той же группой.

Пример:
  python manage.py import_csv_participants \\
    --eventum-slug=my-fest \\
    --csv /path/to/list.csv

Опции:
  --dry-run  не писать в БД: сводка и (с --verbose) план по строкам
  --verbose  вместе с --dry-run — строка плана на каждую запись CSV
  --update-user-names  обновлять имя UserProfile из CSV, если пользователь уже есть
  --vk-api-delay  секунды паузы перед каждым запросом VK по нику (по умол. 0.35)
  --vk-api-retries  повторов при коде 6 «Too many requests per second»
"""

import csv
import os
import re
import time
from pathlib import Path
from urllib.parse import urlparse

import requests
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from app.models import (
    Eventum,
    Participant,
    ParticipantGroup,
    ParticipantGroupParticipantRelation,
    UserProfile,
)


VK_HOSTS = frozenset(
    {
        "vk.com",
        "www.vk.com",
        "m.vk.com",
        "vk.ru",
        "www.vk.ru",
        "m.vk.ru",
    }
)
VK_PATH_ID_RE = re.compile(r"^id(\d+)$", re.IGNORECASE)
# Ник в пути: латиница, цифры, точка, подчёркивание (как в типичных коротких ссылках VK)
VK_SCREEN_RE = re.compile(r"^[a-zA-Z0-9._-]+$")


def _vk_path_screen_or_numeric(url: str) -> tuple[int | None, str | None]:
    """
    Из ссылки VK достаёт либо числовой id из сегмента id123…, либо ник из первого сегмента пути.
    Возвращает (numeric_id, None) или (None, screen_name) или (None, None) если не распознано.
    """
    raw = (url or "").strip()
    if not raw:
        return None, None
    if not raw.startswith(("http://", "https://")):
        raw = "https://" + raw
    parsed = urlparse(raw)
    host = (parsed.netloc or "").lower().split(":")[0]
    if host not in VK_HOSTS:
        return None, None
    path = (parsed.path or "").strip("/")
    if not path:
        return None, None
    first = path.split("/")[0]
    m = VK_PATH_ID_RE.match(first)
    if m:
        return int(m.group(1)), None
    if VK_SCREEN_RE.match(first) and len(first) <= 64:
        return None, first
    return None, None


def resolve_vk_numeric_id(
    url: str,
    *,
    service_token: str,
    screen_cache: dict[str, int],
    vk_api_delay: float = 0.35,
    vk_api_max_retries: int = 5,
) -> tuple[int | None, str | None]:
    """
    Числовой vk id: из сегмента id… в URL или через users.get по нику (нужен токен).
    Возвращает (id, None) или (None, текст ошибки для лога).
    """
    num_id, screen = _vk_path_screen_or_numeric(url)
    if num_id is not None:
        return num_id, None
    if screen is None:
        return None, "неподдерживаемый формат ссылки VK"
    key = screen.lower()
    if key in screen_cache:
        return screen_cache[key], None
    token = (service_token or "").strip()
    if not token:
        return (
            None,
            "для ссылки с ником нужен VK_SERVICE_ACCESS_TOKEN (сервисный ключ приложения VK)",
        )

    last_error_msg: str | None = None
    for attempt in range(max(1, vk_api_max_retries)):
        if vk_api_delay > 0:
            time.sleep(vk_api_delay)
        try:
            r = requests.get(
                "https://api.vk.com/method/users.get",
                params={
                    "user_ids": screen,
                    "access_token": token,
                    "v": "5.131",
                },
                timeout=30,
            )
            r.raise_for_status()
            data = r.json()
        except (requests.RequestException, ValueError) as e:
            return None, f"VK API (ник «{screen}»): запрос не удался: {e}"

        if "error" not in data:
            break

        err = data["error"]
        msg = err.get("error_msg", str(err))
        code = err.get("error_code", "")
        last_error_msg = f"VK API (ник «{screen}»): {code} {msg}"
        # 6 = Too many requests per second
        if code == 6 and attempt < vk_api_max_retries - 1:
            extra = 1.0 + 1.5 * attempt
            time.sleep(extra)
            continue
        return None, last_error_msg

    rows = data.get("response") or []
    if not rows:
        return None, f"VK API: пустой ответ для «{screen}»"
    uid = int(rows[0]["id"])
    screen_cache[key] = uid
    return uid, None


def normalize_group_name(raw: str) -> str:
    # NBSP и прочие пробельные символы из таблиц → обычный пробел
    s = (raw or "").replace("\u00a0", " ").replace("\u202f", " ")
    return " ".join(s.split()).strip()


class Command(BaseCommand):
    help = "Импорт участников из CSV (ФИО, группа, ссылка VK) в указанный eventum"

    def add_arguments(self, parser):
        parser.add_argument(
            "--eventum-slug",
            required=True,
            help="Slug eventum (из URL / поддомена)",
        )
        parser.add_argument(
            "--csv",
            dest="csv_path",
            required=True,
            type=str,
            help="Путь к CSV-файлу",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Не писать в БД, только отчёт",
        )
        parser.add_argument(
            "--update-user-names",
            action="store_true",
            help="Если пользователь с vk_id уже есть, обновить поле name из CSV",
        )
        parser.add_argument(
            "--verbose",
            action="store_true",
            help="В dry-run: печатать план по каждой строке CSV",
        )
        parser.add_argument(
            "--vk-api-delay",
            type=float,
            default=0.35,
            help="Пауза в секундах перед каждым запросом users.get по нику (по умолчанию 0.35)",
        )
        parser.add_argument(
            "--vk-api-retries",
            type=int,
            default=5,
            help="Число попыток при ответе VK с кодом 6 (Too many requests per second)",
        )

    def handle(self, *args, **options):
        slug = options["eventum_slug"]
        csv_path = Path(options["csv_path"]).expanduser().resolve()
        dry_run = options["dry_run"]
        update_user_names = options["update_user_names"]
        verbose = options["verbose"]
        vk_api_delay = max(0.0, options["vk_api_delay"])
        vk_api_retries = max(1, options["vk_api_retries"])

        if not csv_path.is_file():
            raise CommandError(f"Файл не найден: {csv_path}")

        try:
            eventum = Eventum.objects.get(slug=slug)
        except Eventum.DoesNotExist as e:
            raise CommandError(f"Eventum со slug «{slug}» не найден") from e

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    "Режим dry-run: база данных не изменяется, только отчёт."
                )
            )

        stats = {
            "rows": 0,
            "skipped": 0,
            "users_created": 0,
            "users_existing": 0,
            "users_renamed": 0,
            "participants_created": 0,
            "participants_existing": 0,
            "groups_created": 0,
            "groups_existing": 0,
            "relations_created": 0,
            "relations_existing": 0,
            "errors": 0,
        }

        screen_cache: dict[str, int] = {}
        # Берём из окружения процесса в момент запуска (в т.ч. VAR=value python manage.py …)
        service_token = (
            os.environ.get("VK_SERVICE_ACCESS_TOKEN", "").strip()
            or (getattr(settings, "VK_SERVICE_ACCESS_TOKEN", None) or "").strip()
        )

        with csv_path.open(encoding="utf-8-sig", newline="") as f:
            reader = csv.reader(f)
            for row_num, row in enumerate(reader, start=1):
                if not row or all(not (c or "").strip() for c in row):
                    continue
                stats["rows"] += 1

                if len(row) < 3:
                    self.stderr.write(
                        self.style.WARNING(
                            f"Строка {row_num}: ожидаются 3 колонки, пропуск"
                        )
                    )
                    stats["skipped"] += 1
                    continue

                full_name = (row[0] or "").strip()
                group_name = normalize_group_name(row[1])
                vk_url = (row[2] or "").strip()

                vk_id, vk_resolve_err = resolve_vk_numeric_id(
                    vk_url,
                    service_token=service_token,
                    screen_cache=screen_cache,
                    vk_api_delay=vk_api_delay,
                    vk_api_max_retries=vk_api_retries,
                )
                if vk_id is None:
                    detail = vk_resolve_err or f"не удалось получить vk id из «{vk_url}»"
                    self.stderr.write(
                        self.style.WARNING(f"Строка {row_num}: {detail}, пропуск")
                    )
                    stats["skipped"] += 1
                    continue

                if not full_name:
                    self.stderr.write(
                        self.style.WARNING(f"Строка {row_num}: пустое ФИО, пропуск")
                    )
                    stats["skipped"] += 1
                    continue

                if not group_name:
                    self.stderr.write(
                        self.style.WARNING(f"Строка {row_num}: пустая группа, пропуск")
                    )
                    stats["skipped"] += 1
                    continue

                try:
                    self._process_row(
                        eventum=eventum,
                        full_name=full_name,
                        group_name=group_name,
                        vk_id=vk_id,
                        row_num=row_num,
                        dry_run=dry_run,
                        update_user_names=update_user_names,
                        verbose=verbose,
                        stats=stats,
                    )
                except Exception as exc:
                    stats["errors"] += 1
                    self.stderr.write(
                        self.style.ERROR(f"Строка {row_num}: {exc}")
                    )

        self.stdout.write(self.style.SUCCESS("Готово."))
        for k, v in stats.items():
            self.stdout.write(f"  {k}: {v}")

    def _process_row(
        self,
        *,
        eventum: Eventum,
        full_name: str,
        group_name: str,
        vk_id: int,
        row_num: int,
        dry_run: bool,
        update_user_names: bool,
        verbose: bool,
        stats: dict,
    ):
        if dry_run:
            self._dry_run_row(
                eventum=eventum,
                full_name=full_name,
                group_name=group_name,
                vk_id=vk_id,
                row_num=row_num,
                update_user_names=update_user_names,
                verbose=verbose,
                stats=stats,
            )
            return

        with transaction.atomic():
            user = UserProfile.objects.filter(vk_id=vk_id).first()
            if user is None:
                user = UserProfile.objects.create_user(vk_id=vk_id, name=full_name)
                stats["users_created"] += 1
            else:
                stats["users_existing"] += 1
                if update_user_names and user.name != full_name:
                    user.name = full_name
                    user.save(update_fields=["name"])
                    stats["users_renamed"] += 1

            participant, p_created = Participant.objects.get_or_create(
                user=user,
                eventum=eventum,
                defaults={"name": full_name},
            )
            if p_created:
                stats["participants_created"] += 1
            else:
                stats["participants_existing"] += 1
                if participant.name != full_name:
                    participant.name = full_name
                    participant.save(update_fields=["name"])

            # Одна запись ParticipantGroup на пару (eventum, имя): все участники с тем же
            # названием группы в CSV попадают в одну группу, новая не создаётся.
            group, g_created = ParticipantGroup.objects.get_or_create(
                eventum=eventum,
                name=group_name,
                is_event_group=False,
                defaults={},
            )
            if g_created:
                stats["groups_created"] += 1
            else:
                stats["groups_existing"] += 1

            rel, r_created = (
                ParticipantGroupParticipantRelation.objects.get_or_create(
                    group=group,
                    participant=participant,
                    defaults={
                        "relation_type": ParticipantGroupParticipantRelation.RelationType.INCLUSIVE
                    },
                )
            )
            if r_created:
                stats["relations_created"] += 1
            else:
                stats["relations_existing"] += 1

    def _dry_run_row(
        self,
        *,
        eventum: Eventum,
        full_name: str,
        group_name: str,
        vk_id: int,
        row_num: int,
        update_user_names: bool,
        verbose: bool,
        stats: dict,
    ):
        user = UserProfile.objects.filter(vk_id=vk_id).first()
        if user is None:
            stats["users_created"] += 1
            user_action = f'создать пользователя «{full_name}»'
        else:
            stats["users_existing"] += 1
            if update_user_names and user.name != full_name:
                stats["users_renamed"] += 1
                user_action = (
                    f'пользователь «{user.name}» в БД — обновить имя на «{full_name}»'
                )
            else:
                user_action = f'пользователь «{user.name}» уже есть'

        participant = (
            Participant.objects.filter(user=user, eventum=eventum).first()
            if user
            else None
        )
        if participant is None:
            stats["participants_created"] += 1
            participant_action = f'создать участника «{full_name}» в этом eventum'
        else:
            stats["participants_existing"] += 1
            name_note = (
                f', обновить ФИО на «{full_name}»'
                if participant.name != full_name
                else ""
            )
            participant_action = f'участник «{participant.name}» уже есть{name_note}'

        group = ParticipantGroup.objects.filter(
            eventum=eventum,
            name=group_name,
            is_event_group=False,
        ).first()
        if group is None:
            stats["groups_created"] += 1
            group_action = f'создать группу «{group_name}»'
        else:
            stats["groups_existing"] += 1
            group_action = (
                f'группа «{group_name}» уже есть (общая для всех с этим названием)'
            )

        # Связь возможна только между существующими participant и group в БД;
        # после реального импорта оба будут (возможно, новые).
        relation_exists_now = False
        if participant is not None and group is not None:
            relation_exists_now = ParticipantGroupParticipantRelation.objects.filter(
                group=group,
                participant=participant,
            ).exists()

        if relation_exists_now:
            stats["relations_existing"] += 1
            relation_action = (
                f'связь «{group_name}» — «{full_name}» (inclusive) уже есть'
            )
        else:
            stats["relations_created"] += 1
            relation_action = (
                f'добавить «{full_name}» в группу «{group_name}» (inclusive)'
            )

        if verbose:
            self.stdout.write(
                f"[{row_num}] vk_id={vk_id} | {user_action}; "
                f"{participant_action}; {group_action}; {relation_action}"
            )
