import time
import logging
from functools import wraps

logger = logging.getLogger(__name__)

def log_execution_time(func_name: str = None):
    """
    Декоратор для логирования времени выполнения функций
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            result = func(*args, **kwargs)
            execution_time = time.time() - start_time
            
            name = func_name or func.__name__
            logger.info(f"{name} выполнен за {execution_time:.3f} секунд")
            
            return result
        return wrapper
    return decorator
