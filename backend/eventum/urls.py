from django.contrib import admin
from django.urls import path, include
from django.conf.urls.static import static
from django.views.static import serve
from django.urls import re_path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('app.urls')),
]

# Раздача статических файлов (работает и в продакшене как fallback)
urlpatterns += static('/static/', document_root='static/')

# Дополнительная настройка для продакшена
from django.conf import settings
if not settings.DEBUG:
    urlpatterns += [
        re_path(r'^static/(?P<path>.*)$', serve, {'document_root': settings.STATIC_ROOT}),
    ]
