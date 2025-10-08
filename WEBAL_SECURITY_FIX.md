# Решение проблемы "The connection is not secure"

## 🔍 Проблема
Webcal ссылка все еще использует HTTP вместо HTTPS:
```
webcal://bbapo5ibqs4eg6dail89.containers.yandexcloud.net/api/eventums/szfo2025/calendar.ics
```

## 🛠️ Решения

### Решение 1: Установить BASE_URL в переменных окружения (рекомендуется)

Установите переменную окружения с HTTPS URL:

```bash
# В переменных окружения или .env файле
BASE_URL=https://bbapo5ibqs4eg6dail89.containers.yandexcloud.net
```

### Решение 2: Проверить настройки сервера

Убедитесь, что ваш сервер правильно настроен на HTTPS:

1. **Проверьте, что сервер принимает HTTPS запросы**
2. **Убедитесь, что SSL сертификат настроен**
3. **Проверьте, что Django настроен на работу с HTTPS**

### Решение 3: Принудительное перенаправление HTTPS

Добавьте в настройки Django:

```python
# В settings.py
SECURE_SSL_REDIRECT = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
```

## 🔧 Что изменилось в коде

1. **Улучшена логика определения HTTPS**:
   - Для localhost/127.0.0.1 → HTTP (разработка)
   - Для всех остальных доменов → HTTPS (продакшен)

2. **Добавлено логирование** для отладки:
   ```python
   logger.info(f"Generated webcal URL: {webcal_url} for participant {participant.name}")
   ```

## 📋 Проверка

После установки BASE_URL проверьте логи сервера - должно появиться сообщение:
```
Generated webcal URL: webcal://bbapo5ibqs4eg6dail89.containers.yandexcloud.net/api/eventums/szfo2025/calendar.ics for participant Имя_Участника
```

## ✅ Ожидаемый результат

После исправления webcal ссылка должна быть:
```
webcal://bbapo5ibqs4eg6dail89.containers.yandexcloud.net/api/eventums/szfo2025/calendar.ics
```

И предупреждение "The connection is not secure" должно исчезнуть!
