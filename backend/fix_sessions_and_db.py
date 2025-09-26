#!/usr/bin/env python
"""
Скрипт для исправления проблем с сессиями и базой данных
"""
import os
import sys
import django
from django.conf import settings
from django.core.management import execute_from_command_line

# Настройка Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'eventum.settings')
django.setup()

from django.db import connection
from django.contrib.sessions.models import Session
from django.core.management import call_command
import logging

logger = logging.getLogger(__name__)

def test_database_connection():
    """Тестирует соединение с базой данных"""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
            print("✅ Соединение с базой данных работает корректно")
            return True
    except Exception as e:
        print(f"❌ Ошибка соединения с базой данных: {e}")
        return False

def clear_problematic_sessions():
    """Очищает проблемные сессии"""
    try:
        # Подсчитываем количество сессий до очистки
        total_sessions = Session.objects.count()
        print(f"📊 Всего сессий в базе данных: {total_sessions}")
        
        # Очищаем все сессии (это безопасно, пользователи просто перелогинятся)
        deleted_count = Session.objects.all().delete()[0]
        print(f"🗑️  Удалено проблемных сессий: {deleted_count}")
        
        # Проверяем, что таблица пуста
        remaining_sessions = Session.objects.count()
        print(f"📊 Оставшихся сессий: {remaining_sessions}")
        
        return True
    except Exception as e:
        print(f"❌ Ошибка при очистке сессий: {e}")
        return False

def run_migrations():
    """Запускает миграции"""
    try:
        print("🔄 Запуск миграций...")
        call_command('migrate', verbosity=0)
        print("✅ Миграции выполнены успешно")
        return True
    except Exception as e:
        print(f"❌ Ошибка при выполнении миграций: {e}")
        return False

def check_session_table():
    """Проверяет структуру таблицы сессий"""
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'django_session'
                ORDER BY ordinal_position
            """)
            columns = cursor.fetchall()
            
            if columns:
                print("✅ Таблица django_session существует")
                print("📋 Структура таблицы:")
                for column_name, data_type in columns:
                    print(f"   - {column_name}: {data_type}")
                return True
            else:
                print("❌ Таблица django_session не найдена")
                return False
    except Exception as e:
        print(f"❌ Ошибка при проверке таблицы сессий: {e}")
        return False

def main():
    """Основная функция"""
    print("🔧 Исправление проблем с сессиями и базой данных")
    print("=" * 50)
    
    # Тестируем соединение с базой данных
    if not test_database_connection():
        print("❌ Не удается подключиться к базе данных. Проверьте настройки.")
        return False
    
    # Проверяем таблицу сессий
    if not check_session_table():
        print("❌ Проблема с таблицей сессий. Запускаем миграции...")
        if not run_migrations():
            return False
    
    # Очищаем проблемные сессии
    if not clear_problematic_sessions():
        return False
    
    print("\n✅ Все проблемы исправлены!")
    print("💡 Рекомендации:")
    print("   - Перезапустите сервер Django")
    print("   - Пользователям потребуется войти в систему заново")
    print("   - Мониторьте логи на предмет повторных ошибок")
    
    return True

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
