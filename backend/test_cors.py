#!/usr/bin/env python3
"""
Скрипт для тестирования CORS настроек
"""
import requests
import json

# URL вашего API
BASE_URL = "https://bbapo5ibqs4eg6dail89.containers.yandexcloud.net"
TEST_URL = f"{BASE_URL}/api/cors-test/"

def test_cors_get():
    """Тест GET запроса"""
    print("=== Тест GET запроса ===")
    try:
        response = requests.get(TEST_URL, timeout=10)
        print(f"Status: {response.status_code}")
        print(f"Headers: {dict(response.headers)}")
        print(f"Response: {response.text}")
        print()
    except Exception as e:
        print(f"Ошибка: {e}")
        print()

def test_cors_post():
    """Тест POST запроса"""
    print("=== Тест POST запроса ===")
    try:
        data = {"test": "data", "message": "Hello CORS!"}
        headers = {
            'Content-Type': 'application/json',
        }
        response = requests.post(TEST_URL, json=data, headers=headers, timeout=10)
        print(f"Status: {response.status_code}")
        print(f"Headers: {dict(response.headers)}")
        print(f"Response: {response.text}")
        print()
    except Exception as e:
        print(f"Ошибка: {e}")
        print()

def test_cors_options():
    """Тест OPTIONS запроса (preflight)"""
    print("=== Тест OPTIONS запроса (preflight) ===")
    try:
        headers = {
            'Origin': 'https://eventum-web-ui.vercel.app',
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'Content-Type',
        }
        response = requests.options(TEST_URL, headers=headers, timeout=10)
        print(f"Status: {response.status_code}")
        print(f"Headers: {dict(response.headers)}")
        print(f"Response: {response.text}")
        print()
    except Exception as e:
        print(f"Ошибка: {e}")
        print()

def test_event_creation():
    """Тест создания события"""
    print("=== Тест создания события ===")
    try:
        url = f"{BASE_URL}/api/eventums/slet-vozhatyh-plamya-serdets/events/?access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzU4OTk2ODU5LCJpYXQiOjE3NTg5OTMyNTksImp0aSI6ImE1ZmZkODRlMDE3YTQwYjZhMDYwNTNlYWVjYzRlMzk4IiwidXNlcl9pZCI6IjIifQ.Qy8ap2gi7NzlK9nqfFqCBx_ND3IgIF7dIbc1Zusd1Hc"
        data = {
            "name": "test event",
            "description": "sdf",
            "start_time": "2025-09-28T00:00",
            "end_time": "2025-09-28T01:00",
            "location_id": 6,
            "tag_ids": [1]
        }
        headers = {
            'Content-Type': 'application/json',
        }
        response = requests.post(url, json=data, headers=headers, timeout=10)
        print(f"Status: {response.status_code}")
        print(f"Headers: {dict(response.headers)}")
        print(f"Response: {response.text}")
        print()
    except Exception as e:
        print(f"Ошибка: {e}")
        print()

if __name__ == "__main__":
    print("Тестирование CORS настроек...")
    print(f"Тестируем URL: {TEST_URL}")
    print()
    
    test_cors_get()
    test_cors_options()
    test_cors_post()
    test_event_creation()
    
    print("Тестирование завершено!")
