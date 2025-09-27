import logging
import time
from functools import wraps

from django.utils.text import slugify
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from transliterate import translit

logger = logging.getLogger(__name__)


def log_execution_time(func_name: str = None):
    """Декоратор для логирования времени выполнения функций."""

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            result = func(*args, **kwargs)
            execution_time = time.time() - start_time

            name = func_name or func.__name__
            logger.info(f"{name} выполнен за {execution_time:.3f} секунд")

            return result

        return wrapper

    return decorator


def generate_unique_slug(instance, value, *, slug_field: str = "slug", scope_fields=None):
    """Генерирует уникальный slug для модели."""

    scope_fields = scope_fields or []

    try:
        base_value = translit(value, "ru", reversed=True)
    except Exception:
        # Если транслитерация невозможна (например, текст уже на латинице),
        # используем исходное значение.
        base_value = value

    base_slug = slugify(base_value)
    if not base_slug:
        base_slug = "item"

    slug = base_slug
    ModelClass = instance.__class__

    filter_kwargs = {slug_field: slug}
    for field in scope_fields:
        if hasattr(instance, f"{field}_id"):
            field_value = getattr(instance, field)
            if field_value is not None:
                filter_kwargs[field] = field_value

    counter = 1
    while ModelClass.objects.filter(**filter_kwargs).exclude(pk=instance.pk).exists():
        slug = f"{base_slug}-{counter}"
        filter_kwargs[slug_field] = slug
        counter += 1

    return slug


def csrf_exempt_api(view_func):
    """
    Декоратор для отключения CSRF защиты для API endpoints
    """
    return csrf_exempt(view_func)


def csrf_exempt_class_api(view_class):
    """
    Декоратор класса для отключения CSRF защиты для API ViewSets
    """
    return method_decorator(csrf_exempt, name='dispatch')(view_class)
