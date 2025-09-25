#!/bin/bash

# Скрипт для запуска локального бекенда Eventum

echo "🚀 Запуск локального бекенда Eventum..."

# Переходим в директорию бекенда
cd backend

# Активируем виртуальное окружение
source ../venv/bin/activate

# Запускаем Django сервер
echo "📡 Запуск Django сервера на http://localhost:8000"
python manage.py runserver 0.0.0.0:8000
