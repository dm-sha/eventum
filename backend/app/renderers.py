from rest_framework.renderers import BaseRenderer


class ICalendarRenderer(BaseRenderer):
    """
    Renderer для iCalendar формата (.ics файлы) с типом text/calendar
    """
    media_type = 'text/calendar'
    format = 'ics'
    charset = 'utf-8'

    def render(self, data, media_type=None, renderer_context=None):
        """
        Рендерит данные в формат iCalendar
        """
        if isinstance(data, str):
            return data.encode(self.charset)
        elif isinstance(data, bytes):
            return data
        else:
            # Если данные не строка и не байты, пытаемся преобразовать в строку
            return str(data).encode(self.charset)


class ICalendarApplicationRenderer(BaseRenderer):
    """
    Renderer для iCalendar формата (.ics файлы) с типом application/calendar
    """
    media_type = 'application/calendar'
    format = 'ics'
    charset = 'utf-8'

    def render(self, data, media_type=None, renderer_context=None):
        """
        Рендерит данные в формат iCalendar
        """
        if isinstance(data, str):
            return data.encode(self.charset)
        elif isinstance(data, bytes):
            return data
        else:
            # Если данные не строка и не байты, пытаемся преобразовать в строку
            return str(data).encode(self.charset)
