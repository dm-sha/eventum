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


def csrf_exempt_class_api(view_class):
    """
    Декоратор класса для отключения CSRF защиты для API ViewSets
    """
    return method_decorator(csrf_exempt, name='dispatch')(view_class)


def get_group_participant_ids(
    group, 
    all_participant_ids=None, 
    visited_groups=None, 
    prefetch_nested_groups=False
):
    """
    Получает ID участников группы используя уже загруженные данные (prefetch_related).
    Работает полностью в памяти Python без дополнительных запросов к БД.
    
    Args:
        group: Группа участников (ParticipantGroupV2)
        all_participant_ids: Множество всех ID участников eventum (для случая, когда нет inclusive связей)
        visited_groups: Множество ID уже посещенных групп (для предотвращения циклов)
        prefetch_nested_groups: Если True, загружает связи для вложенных групп, если они не prefetch'нуты
    
    Returns:
        set: Множество ID участников, которые принадлежат группе
    """
    from .models import ParticipantGroupV2ParticipantRelation, ParticipantGroupV2GroupRelation, ParticipantGroupV2
    
    if not group:
        return set()
    
    if visited_groups is None:
        visited_groups = set()
    
    # Предотвращаем циклические ссылки
    if group.id in visited_groups:
        return set()
    
    visited_groups.add(group.id)
    
    # Получаем все participant_relations из prefetch_related
    participant_relations = []
    if hasattr(group, '_prefetched_objects_cache') and 'participant_relations' in group._prefetched_objects_cache:
        participant_relations = group._prefetched_objects_cache['participant_relations']
    else:
        # Fallback: если prefetch не сработал, загружаем связи напрямую
        participant_relations = list(ParticipantGroupV2ParticipantRelation.objects.filter(
            group=group
        ).select_related('participant'))
    
    # Получаем все group_relations из prefetch_related
    group_relations = []
    if hasattr(group, '_prefetched_objects_cache') and 'group_relations' in group._prefetched_objects_cache:
        group_relations = group._prefetched_objects_cache['group_relations']
        # Для вложенных групп также prefetch'им их связи, если они еще не загружены
        if prefetch_nested_groups:
            for group_rel in group_relations:
                target_group = group_rel.target_group
                if target_group and not hasattr(target_group, '_prefetched_objects_cache'):
                    # Если у target_group нет prefetch'нутых данных, загружаем их
                    target_group._prefetched_objects_cache = {}
                    target_group._prefetched_objects_cache['participant_relations'] = list(
                        ParticipantGroupV2ParticipantRelation.objects.filter(
                            group=target_group
                        ).select_related('participant')
                    )
                    target_group._prefetched_objects_cache['group_relations'] = list(
                        ParticipantGroupV2GroupRelation.objects.filter(
                            group=target_group
                        ).select_related('target_group')
                    )
    else:
        # Fallback: если prefetch не сработал, загружаем связи напрямую
        group_relations = list(ParticipantGroupV2GroupRelation.objects.filter(
            group=group
        ).select_related('target_group'))
    
    # Проверяем, есть ли хотя бы одна inclusive связь
    has_inclusive_participants = any(
        rel.relation_type == ParticipantGroupV2ParticipantRelation.RelationType.INCLUSIVE
        for rel in participant_relations
    )
    has_inclusive_groups = any(
        rel.relation_type == ParticipantGroupV2GroupRelation.RelationType.INCLUSIVE
        for rel in group_relations
    )
    
    # Если нет ни участников, ни inclusive групп
    if not has_inclusive_participants and not has_inclusive_groups:
        # - Если нет никаких связей - возвращаем всех участников eventum
        # - Если только exclusive связи - возвращаем всех участников eventum кроме exclusive
        all_participant_ids = all_participant_ids or set()
        
        # Исключаем excluded участников
        excluded_participant_ids = set()
        for rel in participant_relations:
            if rel.relation_type == ParticipantGroupV2ParticipantRelation.RelationType.EXCLUSIVE:
                excluded_participant_ids.add(rel.participant_id)
        
        # Исключаем участников из excluded групп (рекурсивно)
        for group_rel in group_relations:
            if group_rel.relation_type == ParticipantGroupV2GroupRelation.RelationType.EXCLUSIVE:
                target_group = group_rel.target_group
                if not target_group and group_rel.target_group_id:
                    # Если объекта нет, но есть ID, создаем минимальный объект для работы
                    # target_group должен быть из того же eventum
                    target_group = ParticipantGroupV2(id=group_rel.target_group_id, eventum_id=group.eventum_id)
                if target_group:
                    excluded_participant_ids.update(
                        get_group_participant_ids(
                            target_group, 
                            all_participant_ids=all_participant_ids,
                            visited_groups=visited_groups.copy(), 
                            prefetch_nested_groups=prefetch_nested_groups
                        )
                    )
        
        result = all_participant_ids - excluded_participant_ids
        return result
    else:
        # Стандартная логика включений/исключений
        included_participant_ids = set()
        excluded_participant_ids = set()
        
        # Обрабатываем прямые связи с участниками
        for rel in participant_relations:
            if rel.relation_type == ParticipantGroupV2ParticipantRelation.RelationType.INCLUSIVE:
                included_participant_ids.add(rel.participant_id)
            elif rel.relation_type == ParticipantGroupV2ParticipantRelation.RelationType.EXCLUSIVE:
                excluded_participant_ids.add(rel.participant_id)
        
        # Обрабатываем связи с группами
        for group_rel in group_relations:
            target_group = group_rel.target_group
            if not target_group and group_rel.target_group_id:
                # Если объекта нет, но есть ID, создаем минимальный объект для работы
                # target_group должен быть из того же eventum
                target_group = ParticipantGroupV2(id=group_rel.target_group_id, eventum_id=group.eventum_id)
            if target_group:
                target_participant_ids = get_group_participant_ids(
                    target_group, 
                    all_participant_ids=all_participant_ids,
                    visited_groups=visited_groups.copy(), 
                    prefetch_nested_groups=prefetch_nested_groups
                )
                
                if group_rel.relation_type == ParticipantGroupV2GroupRelation.RelationType.INCLUSIVE:
                    included_participant_ids.update(target_participant_ids)
                elif group_rel.relation_type == ParticipantGroupV2GroupRelation.RelationType.EXCLUSIVE:
                    excluded_participant_ids.update(target_participant_ids)
        
        # Исключаем участников из списка включенных
        included_participant_ids -= excluded_participant_ids
        
        return included_participant_ids
