from django.contrib import admin
from django.urls import path, include
from django.conf.urls.static import static
from django.conf import settings
from django.views.static import serve
from django.urls import re_path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('app.urls')),
]

# Раздача статических файлов (работает и в продакшене как fallback)
urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# Дополнительная настройка для продакшена
if not settings.DEBUG:
    urlpatterns += [
        re_path(r'^static/(?P<path>.*)$', serve, {'document_root': settings.STATIC_ROOT}),
    ]
