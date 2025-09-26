#!/usr/bin/env python
"""
Скрипт для мониторинга соединения с базой данных
"""
import os
import sys
import time
import django
from django.conf import settings
from django.db import connection, transaction
import logging

# Настройка Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'eventum.settings')
django.setup()

logger = logging.getLogger(__name__)

def test_connection():
    """Тестирует соединение с базой данных"""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
            return True, "OK"
    except Exception as e:
        return False, str(e)

def test_transaction():
    """Тестирует транзакцию"""
    try:
        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute("SELECT NOW()")
                result = cursor.fetchone()
            return True, "OK"
    except Exception as e:
        return False, str(e)

def monitor_connection(duration_minutes=5, interval_seconds=10):
    """Мониторит соединение с базой данных"""
    print(f"🔍 Мониторинг соединения с базой данных в течение {duration_minutes} минут")
    print(f"⏱️  Интервал проверки: {interval_seconds} секунд")
    print("=" * 60)
    
    start_time = time.time()
    end_time = start_time + (duration_minutes * 60)
    
    success_count = 0
    error_count = 0
    ssl_errors = 0
    session_errors = 0
    
    while time.time() < end_time:
        current_time = time.strftime("%H:%M:%S")
        
        # Тест простого соединения
        conn_success, conn_error = test_connection()
        
        # Тест транзакции
        trans_success, trans_error = test_transaction()
        
        if conn_success and trans_success:
            print(f"[{current_time}] ✅ Соединение: OK | Транзакция: OK")
            success_count += 1
        else:
            error_count += 1
            error_msg = conn_error if not conn_success else trans_error
            
            # Классифицируем ошибки
            if "SSL" in error_msg.upper() or "EOF" in error_msg.upper():
                ssl_errors += 1
                print(f"[{current_time}] ❌ SSL/EOF ошибка: {error_msg}")
            elif "session" in error_msg.lower() or "_session_cache" in error_msg:
                session_errors += 1
                print(f"[{current_time}] ❌ Ошибка сессии: {error_msg}")
            else:
                print(f"[{current_time}] ❌ Другая ошибка: {error_msg}")
        
        time.sleep(interval_seconds)
    
    # Статистика
    total_tests = success_count + error_count
    success_rate = (success_count / total_tests * 100) if total_tests > 0 else 0
    
    print("\n" + "=" * 60)
    print("📊 СТАТИСТИКА МОНИТОРИНГА")
    print("=" * 60)
    print(f"✅ Успешных тестов: {success_count}")
    print(f"❌ Ошибок: {error_count}")
    print(f"📈 Процент успеха: {success_rate:.1f}%")
    print(f"🔒 SSL/EOF ошибок: {ssl_errors}")
    print(f"🍪 Ошибок сессий: {session_errors}")
    
    if ssl_errors > 0:
        print("\n💡 Рекомендации для SSL ошибок:")
        print("   - Проверьте стабильность сетевого соединения")
        print("   - Убедитесь, что сервер БД доступен")
        print("   - Рассмотрите увеличение CONN_MAX_AGE")
    
    if session_errors > 0:
        print("\n💡 Рекомендации для ошибок сессий:")
        print("   - Запустите: python fix_sessions_and_db.py")
        print("   - Проверьте настройки SESSION_ENGINE")
        print("   - Убедитесь, что таблица django_session существует")
    
    return success_rate > 80

if __name__ == '__main__':
    if len(sys.argv) > 1:
        try:
            duration = int(sys.argv[1])
        except ValueError:
            duration = 5
    else:
        duration = 5
    
    success = monitor_connection(duration)
    sys.exit(0 if success else 1)
