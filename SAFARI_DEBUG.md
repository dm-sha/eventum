# Отладка проблем с Safari и access_token

## Проблема
В Safari запросы отправляются без `access_token` в URL параметре, в то время как в Chrome всё работает нормально.

## Внесенные исправления

### 1. Отладочные логи
Добавлены подробные логи в `frontend/src/api/client.ts` для отслеживания:
- Определения браузера (Safari vs другие)
- Поиска токенов в различных источниках (localStorage, sessionStorage, cookies)
- Параметров запросов

### 2. Специальные настройки cookies для Safari
В `frontend/src/utils/cookies.ts`:
- Safari требует `secure=true` для `SameSite=None`
- Добавлена специальная логика для Safari

### 3. Fallback механизм для Safari
В `frontend/src/api/client.ts` и `frontend/src/contexts/AuthContext.tsx`:
- Safari пробует все доступные источники токенов
- Сохранение токенов в альтернативных cookies с `SameSite=lax`
- Дополнительные источники: `auth_tokens_alt`, `auth_user_alt`

## Как тестировать

### 1. Откройте Developer Tools в Safari
- Safari → Develop → Show Web Inspector
- Перейдите на вкладку Console

### 2. Проверьте логи
Ищите сообщения вида:
```
[API Client] Browser: Safari, URL: /api/events/
[API Client] localStorage tokens: found/not found
[API Client] Cookie tokens: found/not found
[API Client] sessionStorage tokens: found/not found
[API Client] Safari: Found token in source
[API Client] Access token found, length: 123
[API Client] Request params: {access_token: "..."}
```

### 3. Проверьте cookies
В Developer Tools → Storage → Cookies:
- `auth_tokens` - основной cookie
- `auth_tokens_alt` - альтернативный cookie для Safari
- `auth_user` - данные пользователя
- `auth_user_alt` - альтернативные данные пользователя

### 4. Проверьте Network запросы
В Developer Tools → Network:
- Убедитесь, что запросы содержат `access_token` в query параметрах
- Проверьте, что нет ошибок 401/403

## Возможные проблемы и решения

### 1. Cookies блокируются
**Симптомы**: В логах "Cookie tokens: not found"
**Решение**: 
- Убедитесь, что сайт работает по HTTPS
- Проверьте настройки Safari: Safari → Preferences → Privacy → Cookies and website data

### 2. SameSite проблемы
**Симптомы**: Cookies не сохраняются между доменами
**Решение**: 
- Для HTTPS используем `SameSite=None; Secure`
- Для HTTP используем `SameSite=Lax`

### 3. CORS проблемы
**Симптомы**: Preflight запросы отклоняются
**Решение**: 
- Проверьте настройки CORS в `backend/eventum/settings.py`
- Убедитесь, что домен добавлен в `CORS_ALLOWED_ORIGINS`

## Дополнительная отладка

Если проблема сохраняется, добавьте в консоль браузера:

```javascript
// Проверить все cookies
console.log('All cookies:', document.cookie);

// Проверить localStorage
console.log('localStorage auth_tokens:', localStorage.getItem('auth_tokens'));

// Проверить sessionStorage  
console.log('sessionStorage auth_tokens:', sessionStorage.getItem('auth_tokens'));

// Проверить User Agent
console.log('User Agent:', navigator.userAgent);
console.log('Is Safari:', /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent));
```
