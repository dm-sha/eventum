from django.http import JsonResponse
from .models import Eventum

class EventumAuthMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Skip middleware for non-eventum API paths
        if not request.path.startswith('/api/eventums/'):
            return self.get_response(request)
        
        # For safe methods, we don't need authentication
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return self.get_response(request)
        
        # Extract eventum slug from path
        path_parts = request.path.split('/')
        try:
            eventum_slug = path_parts[3]
            eventum = Eventum.objects.get(slug=eventum_slug)
        except (IndexError, Eventum.DoesNotExist):
            return JsonResponse(
                {'error': 'Eventum not found'}, 
                status=404
            )
        
        # Check password from header
        password = request.META.get('HTTP_X_EVENTUM_PASSWORD', '')
        if not eventum.check_password(password):
            return JsonResponse(
                {'error': 'Invalid eventum password'}, 
                status=403
            )
        
        # Store eventum in request for later use
        request.eventum = eventum
        
        return self.get_response(request)
