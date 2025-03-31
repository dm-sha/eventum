FROM python:3.13-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1


# Теперь можно безопасно обновлять pip
RUN pip install --upgrade pip

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

# # Создаем непривилегированного пользователя
# RUN useradd -m appuser && chown -R appuser:appuser /app
# USER appuser

# Открываем порт
EXPOSE 8000

# Запускаем Gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "4", "--timeout", "120", "config.wsgi:application"]

