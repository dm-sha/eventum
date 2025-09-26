#!/bin/bash

echo "🔧 Обновление SSL-исправлений для VK ID авторизации..."

# Переходим в папку backend
cd backend

# Активируем виртуальное окружение
source ../venv/bin/activate

# Обновляем зависимости
echo "📦 Обновление зависимостей..."
pip install -r requirements.txt

# Применяем миграции (если нужно)
echo "🗄️ Проверка миграций..."
python manage.py migrate

# Собираем статические файлы
echo "📁 Сбор статических файлов..."
python manage.py collectstatic --noinput

echo "✅ SSL-исправления применены!"
echo "🚀 Запуск сервера..."
python manage.py runserver 0.0.0.0:8000
