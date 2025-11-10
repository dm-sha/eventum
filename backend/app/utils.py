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


class EventumGroupGraph:
    """
    Класс для хранения adjacency list всех групп внутри одного eventum.
    Создается один раз на запрос к API и кеширует результаты вычислений.
    """
    
    def __init__(self, eventum, participants_map=None):
        """
        Инициализирует граф групп для eventum.
        
        Args:
            eventum: Объект Eventum или eventum_id
            participants_map: Словарь {participant_id: Participant} или None.
                            Если None, загружает всех участников eventum.
        """
        from .models import (
            ParticipantGroupV2, 
            ParticipantGroupV2ParticipantRelation, 
            ParticipantGroupV2GroupRelation,
            Participant
        )
        
        # Получаем eventum_id
        if hasattr(eventum, 'id'):
            self.eventum_id = eventum.id
            self.eventum = eventum
        else:
            self.eventum_id = eventum
            self.eventum = None
        
        # Загружаем или используем переданную мапу участников
        if participants_map is None:
            participants = Participant.objects.filter(eventum_id=self.eventum_id)
            self.participants_map = {p.id: p for p in participants}
        else:
            self.participants_map = participants_map
        
        # Загружаем все группы eventum
        groups = ParticipantGroupV2.objects.filter(eventum_id=self.eventum_id)
        
        # Строим структуру данных для каждой группы
        # Структура: {group_id: {
        #   'name': str,
        #   'inclusive_participants': list[participant_id],
        #   'exclusive_participants': list[participant_id],
        #   'inclusive_groups': list[group_id],
        #   'exclusive_groups': list[group_id],
        #   'group_obj': ParticipantGroupV2
        # }}
        self.groups_data = {}
        
        # Локальные структуры для быстрого доступа O(1)
        # {group_id: {participant_id: True}} для быстрой проверки наличия связи
        self.inclusive_participants_map = {}
        self.exclusive_participants_map = {}
        # {group_id: {target_group_id: True}} для быстрой проверки наличия связи
        self.inclusive_groups_map = {}
        self.exclusive_groups_map = {}
        
        # Загружаем все связи одним запросом
        group_ids = [g.id for g in groups]
        participant_relations = ParticipantGroupV2ParticipantRelation.objects.filter(
            group_id__in=group_ids
        )
        group_relations = ParticipantGroupV2GroupRelation.objects.filter(
            group_id__in=group_ids
        )
        
        # Создаем словари для быстрого доступа к связям по group_id
        participant_relations_by_group = {}
        group_relations_by_group = {}
        
        for rel in participant_relations:
            if rel.group_id not in participant_relations_by_group:
                participant_relations_by_group[rel.group_id] = []
            participant_relations_by_group[rel.group_id].append(rel)
        
        for rel in group_relations:
            if rel.group_id not in group_relations_by_group:
                group_relations_by_group[rel.group_id] = []
            group_relations_by_group[rel.group_id].append(rel)
        
        # Заполняем структуру данных для каждой группы
        for group in groups:
            group_id = group.id
            
            # Инициализируем структуру для группы
            self.groups_data[group_id] = {
                'name': group.name,
                'inclusive_participants': [],
                'exclusive_participants': [],
                'inclusive_groups': [],
                'exclusive_groups': [],
                'group_obj': group
            }
            
            # Инициализируем словари для быстрого доступа
            self.inclusive_participants_map[group_id] = {}
            self.exclusive_participants_map[group_id] = {}
            self.inclusive_groups_map[group_id] = {}
            self.exclusive_groups_map[group_id] = {}
            
            # Заполняем связи с участниками
            relations = participant_relations_by_group.get(group_id, [])
            for rel in relations:
                participant_id = rel.participant_id
                if rel.relation_type == ParticipantGroupV2ParticipantRelation.RelationType.INCLUSIVE:
                    self.groups_data[group_id]['inclusive_participants'].append(participant_id)
                    self.inclusive_participants_map[group_id][participant_id] = True
                elif rel.relation_type == ParticipantGroupV2ParticipantRelation.RelationType.EXCLUSIVE:
                    self.groups_data[group_id]['exclusive_participants'].append(participant_id)
                    self.exclusive_participants_map[group_id][participant_id] = True
            
            # Заполняем связи с группами
            relations = group_relations_by_group.get(group_id, [])
            for rel in relations:
                target_group_id = rel.target_group_id
                if rel.relation_type == ParticipantGroupV2GroupRelation.RelationType.INCLUSIVE:
                    self.groups_data[group_id]['inclusive_groups'].append(target_group_id)
                    self.inclusive_groups_map[group_id][target_group_id] = True
                elif rel.relation_type == ParticipantGroupV2GroupRelation.RelationType.EXCLUSIVE:
                    self.groups_data[group_id]['exclusive_groups'].append(target_group_id)
                    self.exclusive_groups_map[group_id][target_group_id] = True
        
        # Все ID участников eventum
        self.all_participant_ids = set(self.participants_map.keys())
        
        # Кеш для результатов вычислений по группам
        self._participant_ids_cache = {}
    
    def get_participant_ids(self, group_id, visited_groups=None):
        """
        Получает множество ID участников, которые принадлежат группе.
        
        Args:
            group_id: ID группы
            visited_groups: Множество ID уже посещенных групп (для предотвращения циклов)
        
        Returns:
            set: Множество ID участников группы
        """
        if group_id is None:
            return set()
        
        # Проверяем кеш
        if group_id in self._participant_ids_cache:
            return self._participant_ids_cache[group_id]
        
        if visited_groups is None:
            visited_groups = set()
        
        # Предотвращаем циклические ссылки
        if group_id in visited_groups:
            return set()
        
        visited_groups.add(group_id)
        
        # Получаем данные группы
        group_data = self.groups_data.get(group_id)
        if not group_data:
            return set()
        
        # Проверяем, есть ли хотя бы одна inclusive связь
        has_inclusive_participants = bool(group_data['inclusive_participants'])
        has_inclusive_groups = bool(group_data['inclusive_groups'])
        
        # Если нет ни участников, ни inclusive групп
        if not has_inclusive_participants and not has_inclusive_groups:
            # - Если нет никаких связей - возвращаем всех участников eventum
            # - Если только exclusive связи - возвращаем всех участников eventum кроме exclusive
            excluded_participant_ids = set(group_data['exclusive_participants'])
            
            # Исключаем участников из excluded групп (рекурсивно)
            for target_group_id in group_data['exclusive_groups']:
                excluded_participant_ids.update(
                    self.get_participant_ids(target_group_id, visited_groups.copy())
                )
            
            result = self.all_participant_ids - excluded_participant_ids
        else:
            # Стандартная логика включений/исключений
            included_participant_ids = set(group_data['inclusive_participants'])
            excluded_participant_ids = set(group_data['exclusive_participants'])
            
            # Обрабатываем связи с группами
            for target_group_id in group_data['inclusive_groups']:
                included_participant_ids.update(
                    self.get_participant_ids(target_group_id, visited_groups.copy())
                )
            
            for target_group_id in group_data['exclusive_groups']:
                excluded_participant_ids.update(
                    self.get_participant_ids(target_group_id, visited_groups.copy())
                )
            
            # Исключаем участников из списка включенных
            included_participant_ids -= excluded_participant_ids
            result = included_participant_ids
        
        # Кешируем результат
        self._participant_ids_cache[group_id] = result
        return result
    
    def has_participant(self, group_id, participant_id):
        """
        Проверяет, принадлежит ли участник группе.
        
        Args:
            group_id: ID группы
            participant_id: ID участника
        
        Returns:
            bool: True если участник принадлежит группе, False иначе
        """
        if group_id is None:
            return False
        participant_ids = self.get_participant_ids(group_id)
        return participant_id in participant_ids
    
    def get_participant_count(self, group_id):
        """
        Возвращает количество участников в группе.
        
        Args:
            group_id: ID группы
        
        Returns:
            int: Количество участников в группе
        """
        if group_id is None:
            return 0
        return len(self.get_participant_ids(group_id))
    
    def get_group(self, group_id):
        """
        Возвращает объект группы по ID.
        
        Args:
            group_id: ID группы
        
        Returns:
            ParticipantGroupV2 или None
        """
        group_data = self.groups_data.get(group_id)
        return group_data['group_obj'] if group_data else None
    
    def get_group_data(self, group_id):
        """
        Возвращает полные данные группы по ID.
        
        Args:
            group_id: ID группы
        
        Returns:
            dict с данными группы или None
        """
        return self.groups_data.get(group_id)


def get_group_participant_ids(
    group, 
    all_participant_ids=None, 
    visited_groups=None, 
    prefetch_nested_groups=False,
    group_graph=None
):
    """
    Получает ID участников группы используя уже загруженные данные (prefetch_related).
    Работает полностью в памяти Python без дополнительных запросов к БД.
    
    Если передан group_graph, использует его для вычислений.
    Иначе работает в старом режиме для обратной совместимости.
    
    Args:
        group: Группа участников (ParticipantGroupV2) или group_id
        all_participant_ids: Множество всех ID участников eventum (для случая, когда нет inclusive связей)
        visited_groups: Множество ID уже посещенных групп (для предотвращения циклов)
        prefetch_nested_groups: Если True, загружает связи для вложенных групп, если они не prefetch'нуты
        group_graph: Экземпляр EventumGroupGraph для использования (опционально)
    
    Returns:
        set: Множество ID участников, которые принадлежат группе
    """
    # Если передан group_graph, используем его
    if group_graph is not None:
        if hasattr(group, 'id'):
            group_id = group.id
        else:
            group_id = group
        return group_graph.get_participant_ids(group_id, visited_groups)
    
    # Старая логика для обратной совместимости
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
