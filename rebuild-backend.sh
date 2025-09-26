#!/bin/bash

echo "🔄 Пересборка и перезапуск backend контейнера..."

# Переходим в папку backend
cd backend

# Останавливаем и удаляем существующий контейнер
echo "⏹️ Останавливаем существующий контейнер..."
docker stop eventum-backend 2>/dev/null || true
docker rm eventum-backend 2>/dev/null || true

# Собираем новый образ
echo "🔨 Собираем новый образ..."
docker build -t eventum-backend .

# Запускаем новый контейнер
echo "🚀 Запускаем новый контейнер..."
docker run -d \
  --name eventum-backend \
  -p 8000:8000 \
  --env-file .env \
  eventum-backend

echo "✅ Контейнер успешно перезапущен!"
echo "🌐 Админка доступна по адресу: http://localhost:8000/admin/"
echo "📊 API доступно по адресу: http://localhost:8000/api/"
echo "🔍 Отладка статических файлов: http://localhost:8000/api/debug/static-files/"

# Ждем немного чтобы контейнер запустился
echo "⏳ Ждем запуска контейнера..."
sleep 5

# Показываем логи
echo "📋 Логи контейнера:"
docker logs eventum-backend

echo ""
echo "🔍 Проверяем отладочную информацию о статических файлах:"
curl -s http://localhost:8000/api/debug/static-files/ | python3 -m json.tool || echo "Не удалось получить отладочную информацию"
