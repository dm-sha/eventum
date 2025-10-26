from django.contrib import admin
from django.urls import path, include
from django.conf.urls.static import static
from django.views.static import serve
from django.urls import re_path
from django.http import JsonResponse

def healthz_view(request):
    """Health check endpoint for load balancers and deployment systems"""
    return JsonResponse({'status': 'ok'}, status=200)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('app.urls')),
    path('healthz', healthz_view, name='health_check'),
]

# Раздача статических файлов (работает и в продакшене как fallback)
urlpatterns += static('/static/', document_root='static/')

# Дополнительная настройка для продакшена
from django.conf import settings
if not settings.DEBUG:
    urlpatterns += [
        re_path(r'^static/(?P<path>.*)$', serve, {'document_root': settings.STATIC_ROOT}),
    ]
