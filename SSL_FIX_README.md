# Исправление SSL-ошибки при авторизации через VK ID

## Проблема
При попытке авторизации через VK ID возникала ошибка:
```
Authentication error: SSL SYSCALL error: EOF detected
```

## Причина
Ошибка возникала из-за устаревших SSL-настроек в библиотеке `requests` при обращении к VK API. Современные SSL-сертификаты требуют обновленных настроек безопасности.

## Решение

### 1. Обновлены зависимости
- Добавлена `urllib3==2.0.7` для улучшенной SSL-поддержки
- Обновлены настройки `requests` для работы с современными SSL-сертификатами

### 2. Улучшен код авторизации
В файле `backend/app/views.py`:
- Добавлена retry-логика для обработки временных SSL-ошибок
- Настроен правильный SSL-контекст
- Добавлена обработка исключений SSL
- Установлен таймаут для запросов (30 секунд)

### 3. Настроены глобальные SSL-параметры
В файле `backend/eventum/settings.py`:
- Добавлены глобальные SSL-настройки
- Настроено логирование SSL-ошибок
- Отключены предупреждения urllib3

## Как применить исправления

### Автоматически:
```bash
./update-ssl-fix.sh
```

### Вручную:
```bash
cd backend
source ../venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py runserver 0.0.0.0:8000
```

## Тестирование SSL-соединения

Для проверки SSL-соединения с VK API:
```bash
cd backend
source ../venv/bin/activate
python test_ssl_connection.py
```

## Что изменилось

### В `views.py`:
1. **VK ID API запросы** теперь используют:
   - Сессию с retry-логикой
   - Правильный SSL-контекст
   - Обработку SSL-исключений
   - Таймауты

2. **VK OAuth запросы** также обновлены аналогично

3. **VK API запросы** для получения данных пользователя обновлены

### В `settings.py`:
1. Добавлены глобальные SSL-настройки
2. Настроено логирование для отладки SSL-проблем
3. Отключены предупреждения urllib3

### В `requirements.txt`:
1. Добавлена `urllib3==2.0.7`

## Мониторинг

После применения исправлений проверьте логи:
```bash
tail -f backend/auth_debug.log
```

Ищите сообщения:
- `SSL Error during VK ID API call`
- `Request Error during VK ID API call`
- `SSL Error during VK OAuth API call`
- `SSL Error during VK API call`

## Дополнительные рекомендации

1. **Обновите сертификаты системы** (если используете Linux):
   ```bash
   sudo apt-get update
   sudo apt-get install ca-certificates
   ```

2. **Проверьте версию Python** (рекомендуется 3.8+):
   ```bash
   python --version
   ```

3. **Для продакшена** убедитесь, что сервер имеет доступ к интернету и может обновлять SSL-сертификаты.

## Устранение неполадок

Если ошибка все еще возникает:

1. Проверьте интернет-соединение
2. Убедитесь, что сервер может обращаться к `id.vk.ru` и `api.vk.com`
3. Проверьте настройки файрвола
4. Запустите тест SSL-соединения: `python test_ssl_connection.py`
