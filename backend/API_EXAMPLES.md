# API Примеры использования

## Аутентификация через VK

### 1. Получение VK авторизации

Для получения кода авторизации VK, пользователь должен перейти по ссылке:
```
https://oauth.vk.com/authorize?client_id={VK_APP_ID}&redirect_uri={VK_REDIRECT_URI}&display=page&response_type=code&v=5.131
```

### 2. Авторизация через VK ID

**POST** `/api/auth/vk/`

```json
{
    "code": "VK_AUTHORIZATION_CODE"
}
```

**Ответ:**
```json
{
    "access": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "refresh": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "user": {
        "id": 1,
        "vk_id": 123456789,
        "name": "Иван Иванов",
        "avatar_url": "https://vk.com/images/camera_200.png",
        "email": "user@example.com",
        "date_joined": "2024-01-01T00:00:00Z",
        "last_login": "2024-01-01T00:00:00Z"
    }
}
```

### 3. Обновление токена

**POST** `/api/auth/refresh/`

```json
{
    "refresh": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```

**Ответ:**
```json
{
    "access": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```

### 4. Получение профиля пользователя

**GET** `/api/auth/profile/`

**Headers:**
```
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
```

**Ответ:**
```json
{
    "id": 1,
    "vk_id": 123456789,
    "name": "Иван Иванов",
    "avatar_url": "https://vk.com/images/camera_200.png",
    "email": "user@example.com",
    "date_joined": "2024-01-01T00:00:00Z",
    "last_login": "2024-01-01T00:00:00Z"
}
```

### 5. Получение ролей пользователя

**GET** `/api/auth/roles/`

**Headers:**
```
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
```

**Ответ:**
```json
[
    {
        "id": 1,
        "user": {
            "id": 1,
            "vk_id": 123456789,
            "name": "Иван Иванов",
            "avatar_url": "https://vk.com/images/camera_200.png",
            "email": "user@example.com",
            "date_joined": "2024-01-01T00:00:00Z",
            "last_login": "2024-01-01T00:00:00Z"
        },
        "eventum": {
            "id": 1,
            "name": "Мой Eventum",
            "slug": "my-eventum"
        },
        "role": "organizer",
        "created_at": "2024-01-01T00:00:00Z"
    }
]
```

## Управление Eventum'ами

### 1. Список Eventum'ов (только чтение)

**GET** `/api/eventums/`

**Headers:**
```
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
```

### 2. Создание Eventum'а (только для организаторов)

**POST** `/api/eventums/`

**Headers:**
```
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
```

```json
{
    "name": "Новый Eventum"
}
```

### 3. Управление участниками (только для организаторов)

**POST** `/api/eventums/{eventum_slug}/participants/`

**Headers:**
```
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
```

```json
{
    "name": "Новый участник"
}
```

### 4. Просмотр событий (для участников и организаторов)

**GET** `/api/eventums/{eventum_slug}/events/`

**Headers:**
```
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
```

## Права доступа

- **Без роли**: Нет доступа к API
- **Участник**: Только чтение данных eventum'а
- **Организатор**: Полный CRUD доступ к eventum'у и всем его данным

## Настройка VK приложения

Для работы с VK API необходимо:

1. Создать приложение в VK: https://vk.com/apps?act=manage
2. Получить `client_id` и `client_secret`
3. Настроить redirect_uri
4. Добавить переменные окружения:
   ```
   VK_APP_ID=your_vk_app_id
   VK_APP_SECRET=your_vk_app_secret
   VK_REDIRECT_URI=http://localhost:5173/auth/vk/callback
   ```
