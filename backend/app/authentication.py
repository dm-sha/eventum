import base64
import binascii
import hashlib
import hmac
import json
import time
from typing import Any, Dict

from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import exceptions
from rest_framework.authentication import BaseAuthentication, get_authorization_header


class JWTError(Exception):
    """Base class for JWT related errors."""


class InvalidToken(JWTError):
    """Raised when token cannot be validated."""


class ExpiredSignature(JWTError):
    """Raised when token has expired."""


def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def _base64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def encode_jwt(payload: Dict[str, Any], expires_in: int) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())

    token_payload = payload.copy()
    token_payload.setdefault("iat", now)
    token_payload["exp"] = now + expires_in

    header_segment = _base64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_segment = _base64url_encode(json.dumps(token_payload, separators=(",", ":")).encode("utf-8"))

    signing_input = f"{header_segment}.{payload_segment}".encode("utf-8")
    signature = hmac.new(settings.SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
    signature_segment = _base64url_encode(signature)
    return "".join([header_segment, ".", payload_segment, ".", signature_segment])


def decode_jwt(token: str) -> Dict[str, Any]:
    try:
        header_segment, payload_segment, signature_segment = token.split(".")
    except ValueError as exc:
        raise InvalidToken("Token structure is invalid") from exc

    signing_input = f"{header_segment}.{payload_segment}".encode("utf-8")
    expected_signature = hmac.new(settings.SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()

    try:
        actual_signature = _base64url_decode(signature_segment)
    except (ValueError, binascii.Error) as exc:
        raise InvalidToken("Token signature is malformed") from exc

    if not hmac.compare_digest(expected_signature, actual_signature):
        raise InvalidToken("Token signature mismatch")

    try:
        payload = json.loads(_base64url_decode(payload_segment))
    except json.JSONDecodeError as exc:
        raise InvalidToken("Token payload is malformed") from exc

    exp = payload.get("exp")
    if exp is None:
        raise InvalidToken("Token payload missing exp claim")

    if int(time.time()) >= int(exp):
        raise ExpiredSignature("Token has expired")

    return payload


def generate_token_pair(user) -> Dict[str, str]:
    access_ttl = getattr(settings, "ACCESS_TOKEN_LIFETIME", 60 * 60)
    refresh_ttl = getattr(settings, "REFRESH_TOKEN_LIFETIME", 60 * 60 * 24 * 7)
    access = encode_jwt({"user_id": user.id, "token_type": "access"}, access_ttl)
    refresh = encode_jwt({"user_id": user.id, "token_type": "refresh"}, refresh_ttl)
    return {"access": access, "refresh": refresh}


class JWTAuthentication(BaseAuthentication):
    keyword = "bearer"

    def authenticate(self, request):
        auth = get_authorization_header(request).split()
        if not auth:
            return None

        if auth[0].decode("utf-8").lower() != self.keyword:
            return None

        if len(auth) != 2:
            raise exceptions.AuthenticationFailed("Неверный формат заголовка авторизации")

        token = auth[1].decode("utf-8")
        try:
            payload = decode_jwt(token)
        except ExpiredSignature:
            raise exceptions.AuthenticationFailed("Срок действия токена истёк")
        except InvalidToken as exc:
            raise exceptions.AuthenticationFailed(str(exc))

        if payload.get("token_type") != "access":
            raise exceptions.AuthenticationFailed("Неверный тип токена")

        user_id = payload.get("user_id")
        if not user_id:
            raise exceptions.AuthenticationFailed("В токене отсутствует идентификатор пользователя")

        User = get_user_model()
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist as exc:
            raise exceptions.AuthenticationFailed("Пользователь не найден") from exc

        return (user, None)
