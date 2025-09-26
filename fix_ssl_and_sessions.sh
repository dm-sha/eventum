#!/bin/bash

# Скрипт для исправления SSL и проблем с сессиями
echo "🔧 Исправление SSL и проблем с сессиями в Eventum"
echo "=================================================="

# Переходим в директорию backend
cd backend

# Активируем виртуальное окружение
echo "📦 Активация виртуального окружения..."
source ../venv/bin/activate

# Обновляем зависимости
echo "⬆️  Обновление зависимостей..."
pip install -r requirements.txt

# Запускаем скрипт исправления сессий и БД
echo "🔧 Исправление проблем с сессиями и базой данных..."
python fix_sessions_and_db.py

if [ $? -eq 0 ]; then
    echo "✅ Исправление сессий завершено успешно"
else
    echo "❌ Ошибка при исправлении сессий"
    exit 1
fi

# Собираем статические файлы
echo "📁 Сбор статических файлов..."
python manage.py collectstatic --noinput

# Запускаем миграции (на всякий случай)
echo "🔄 Выполнение миграций..."
python manage.py migrate

# Тестируем соединение с базой данных
echo "🧪 Тестирование соединения с базой данных..."
python -c "
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'eventum.settings')
django.setup()
from django.db import connection
try:
    with connection.cursor() as cursor:
        cursor.execute('SELECT 1')
        print('✅ Соединение с базой данных работает')
except Exception as e:
    print(f'❌ Ошибка соединения: {e}')
    exit(1)
"

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Все исправления применены успешно!"
    echo ""
    echo "📋 Что было исправлено:"
    echo "   ✅ Настроены SSL параметры для PostgreSQL"
    echo "   ✅ Добавлены настройки сессий Django"
    echo "   ✅ Очищены проблемные сессии"
    echo "   ✅ Добавлено логирование ошибок БД и сессий"
    echo ""
    echo "🚀 Рекомендации:"
    echo "   1. Перезапустите сервер Django"
    echo "   2. Мониторьте логи: tail -f auth_debug.log"
    echo "   3. Для тестирования: python monitor_db_connection.py"
    echo ""
    echo "🔍 Для мониторинга соединения запустите:"
    echo "   cd backend && python monitor_db_connection.py [минуты]"
else
    echo "❌ Ошибка при тестировании соединения"
    exit 1
fi
