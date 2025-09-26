#!/usr/bin/env python3
"""
Утилита для тестирования SSL-соединений с VK API
"""

import ssl
import socket
import requests
import urllib3
from urllib3.util.retry import Retry
from requests.adapters import HTTPAdapter

def test_ssl_connection():
    """Тестирует SSL-соединение с VK API"""
    
    print("🔍 Тестирование SSL-соединений с VK API...")
    
    # Тест 1: Проверка SSL-сертификата
    print("\n1. Проверка SSL-сертификата...")
    try:
        import ssl
        context = ssl.create_default_context()
        with socket.create_connection(('id.vk.ru', 443), timeout=10) as sock:
            with context.wrap_socket(sock, server_hostname='id.vk.ru') as ssock:
                cert = ssock.getpeercert()
                print(f"✅ SSL-сертификат валиден")
                if isinstance(cert, dict):
                    issuer = cert.get('issuer', {})
                    if isinstance(issuer, dict):
                        print(f"   Сертификат выдан: {issuer.get('organizationName', 'Unknown')}")
                    else:
                        print(f"   Сертификат выдан: {issuer}")
                    print(f"   Действителен до: {cert.get('notAfter', 'Unknown')}")
                else:
                    print(f"   Информация о сертификате: {cert}")
    except Exception as e:
        print(f"❌ Ошибка SSL-сертификата: {e}")
        return False
    
    # Тест 2: HTTP-запрос с retry-логикой
    print("\n2. Тестирование HTTP-запроса...")
    try:
        session = requests.Session()
        
        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET", "POST"]
        )
        
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("https://", adapter)
        
        # Тестовый запрос к VK ID API
        response = session.get(
            'https://id.vk.ru/oauth2/user_info',
            timeout=30,
            verify=True
        )
        
        print(f"✅ HTTP-запрос успешен (статус: {response.status_code})")
        
    except requests.exceptions.SSLError as e:
        print(f"❌ SSL-ошибка: {e}")
        return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Ошибка запроса: {e}")
        return False
    
    # Тест 3: Проверка версии OpenSSL
    print("\n3. Информация о SSL...")
    print(f"   Версия urllib3: {urllib3.__version__}")
    print(f"   Версия requests: {requests.__version__}")
    
    try:
        import ssl
        print(f"   Версия OpenSSL: {ssl.OPENSSL_VERSION}")
    except:
        print("   Версия OpenSSL: неизвестна")
    
    print("\n✅ Все тесты SSL-соединения прошли успешно!")
    return True

if __name__ == "__main__":
    test_ssl_connection()
