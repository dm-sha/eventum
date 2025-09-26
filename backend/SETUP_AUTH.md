# Настройка авторизации

## Переменные окружения

Создайте файл `.env` в папке `backend/` со следующими переменными:

```env
# VK API настройки
VK_APP_ID=your_vk_app_id
VK_APP_SECRET=your_vk_app_secret
VK_REDIRECT_URI=http://localhost:5173/auth/vk/callback

# База данных (уже настроена)
DB_NAME=eventum
DB_USER=eventum_user
DB_PASSWORD=your_password
DB_HOST=localhost
```

## Создание VK приложения

1. Перейдите на https://vk.com/apps?act=manage
2. Нажмите "Создать приложение"
3. Выберите "Веб-сайт"
4. Заполните:
   - Название: Eventum
   - Адрес сайта: http://localhost:5173
   - Базовый домен: localhost
5. В настройках приложения:
   - Добавьте redirect URI: `http://localhost:5173/auth/vk/callback`
   - Скопируйте ID приложения и защищенный ключ

## Тестирование

1. Запустите бэкенд:
   ```bash
   cd backend
   source ../venv/bin/activate
   python manage.py runserver 0.0.0.0:8000
   ```

2. Проверьте API:
   ```bash
   curl -X GET http://localhost:8000/api/eventums/
   # Должен вернуть: {"detail":"Authentication credentials were not provided."}
   ```

3. Создайте тестового пользователя через админку:
   - Перейдите на http://localhost:8000/admin/
   - Войдите с суперпользователем (vk_id: 00001)
   - Создайте UserProfile с реальным VK ID
   - Создайте UserRole для тестирования

## Структура авторизации

### Модели:
- `UserProfile` - профиль пользователя с VK данными
- `UserRole` - роли пользователей для конкретных eventum'ов

### Роли:
- `organizer` - может создавать, редактировать, удалять
- `participant` - может только просматривать

### API эндпоинты:
- `POST /api/auth/vk/` - авторизация через VK
- `POST /api/auth/refresh/` - обновление токена
- `GET /api/auth/profile/` - профиль пользователя
- `GET /api/auth/roles/` - роли пользователя

### Права доступа:
- Все API требуют аутентификации
- EventumViewSet: список - чтение, конкретный - только организаторы
- Остальные ViewSet'ы: организаторы CRUD, участники только чтение
