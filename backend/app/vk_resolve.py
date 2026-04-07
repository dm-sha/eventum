"""
Общая логика разбора ссылок VK и получения числового id (как в CSV-импорте и в API админки).
"""

from __future__ import annotations

import re
import time
from urllib.parse import urlparse

import requests

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


def parse_vk_input(raw: str) -> tuple[int | None, str | None]:
    """
    Разбор ввода: ссылка VK, id123, числовой id, латинский ник (без пробелов).
    """
    s = (raw or "").strip()
    if not s:
        return None, None
    if s.isdigit():
        return int(s), None
    m = VK_PATH_ID_RE.match(s)
    if m:
        return int(m.group(1)), None
    lowered = s.lower()
    if "vk.com" in lowered or "vk.ru" in lowered:
        return _vk_path_screen_or_numeric(s)
    if VK_SCREEN_RE.match(s) and len(s) <= 64:
        return None, s
    return None, None


def resolve_vk_numeric_id(
    query: str,
    *,
    service_token: str,
    screen_cache: dict[str, int],
    vk_api_delay: float = 0.35,
    vk_api_max_retries: int = 5,
) -> tuple[int | None, str | None, dict | None]:
    """
    Числовой vk id из строки запроса; для ника — users.get (нужен сервисный токен).
    Третье значение — первая строка ответа VK (если id получен через users.get по нику), иначе None.
    """
    num_id, screen = parse_vk_input(query)
    if num_id is not None:
        return num_id, None, None
    if screen is None:
        return None, "неподдерживаемый формат ссылки VK", None
    key = screen.lower()
    if key in screen_cache:
        return screen_cache[key], None, None
    token = (service_token or "").strip()
    if not token:
        return (
            None,
            "для ссылки с ником нужен VK_SERVICE_ACCESS_TOKEN (сервисный ключ приложения VK)",
            None,
        )

    last_error_msg: str | None = None
    data: dict | None = None
    for attempt in range(max(1, vk_api_max_retries)):
        if vk_api_delay > 0:
            time.sleep(vk_api_delay)
        try:
            r = requests.get(
                "https://api.vk.com/method/users.get",
                params={
                    "user_ids": screen,
                    "fields": "photo_200",
                    "access_token": token,
                    "v": "5.131",
                },
                timeout=30,
            )
            r.raise_for_status()
            data = r.json()
        except (requests.RequestException, ValueError) as e:
            return None, f"VK API (ник «{screen}»): запрос не удался: {e}", None

        if "error" not in data:
            break

        err = data["error"]
        msg = err.get("error_msg", str(err))
        code = err.get("error_code", "")
        last_error_msg = f"VK API (ник «{screen}»): {code} {msg}"
        if code == 6 and attempt < vk_api_max_retries - 1:
            extra = 1.0 + 1.5 * attempt
            time.sleep(extra)
            continue
        return None, last_error_msg, None

    rows = (data or {}).get("response") or []
    if not rows:
        return None, f"VK API: пустой ответ для «{screen}»", None
    row = rows[0]
    uid = int(row["id"])
    screen_cache[key] = uid
    return uid, None, row


def vk_row_suggested_name(row: dict) -> str | None:
    fn = (row.get("first_name") or "").strip()
    ln = (row.get("last_name") or "").strip()
    name = f"{fn} {ln}".strip()
    return name or None


def fetch_vk_profile_row(
    vk_id: int,
    *,
    service_token: str,
    vk_api_delay: float = 0,
) -> dict | None:
    """Одна запись users.get по числовому id (имя, аватар)."""
    token = (service_token or "").strip()
    if not token:
        return None
    if vk_api_delay > 0:
        time.sleep(vk_api_delay)
    try:
        r = requests.get(
            "https://api.vk.com/method/users.get",
            params={
                "user_ids": str(vk_id),
                "fields": "photo_200",
                "access_token": token,
                "v": "5.131",
            },
            timeout=30,
        )
        r.raise_for_status()
        data = r.json()
    except (requests.RequestException, ValueError):
        return None
    if "error" in data:
        return None
    rows = data.get("response") or []
    return rows[0] if rows else None
