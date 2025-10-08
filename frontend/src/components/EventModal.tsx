import React from 'react';
import type { Event } from '../types';
import './EventCalendar.css';

interface EventModalProps {
  event: Event;
  isOpen: boolean;
  onClose: () => void;
}

const EventModal: React.FC<EventModalProps> = ({ event, isOpen, onClose }) => {
  if (!isOpen) return null;

  const formatDateTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'long'
    });
  };

  const getLocationText = () => {
    if (!event.locations || event.locations.length === 0) {
      return 'Локация не указана';
    }
    
    // Функция для получения уникальных частей пути локаций
    const getUniqueLocationParts = (locations: any[]) => {
      const allParts = new Set<string>();
      
      locations.forEach(loc => {
        const parts = loc.full_path.split(', ');
        parts.forEach((part: string) => allParts.add(part.trim()));
      });
      
      return Array.from(allParts);
    };
    
    const uniqueParts = getUniqueLocationParts(event.locations);
    return uniqueParts.join(', ');
  };


  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Overlay */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity modal-overlay"
          onClick={onClose}
        ></div>
        
        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto transform transition-all">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">{event.name}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-md hover:bg-gray-100"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Изображение */}
            {event.image_url && (
              <div className="w-full">
                <img
                  src={event.image_url}
                  alt={event.name}
                  className="w-full h-48 object-cover rounded-lg shadow-sm"
                />
              </div>
            )}
            
            {/* Описание */}
            {event.description && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Описание</h3>
                <p className="text-gray-600 whitespace-pre-wrap">{event.description}</p>
              </div>
            )}
            
            {/* Время проведения */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Время проведения</h3>
              <div className="space-y-1">
                <div className="flex items-center text-gray-600">
                  <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                  <span className="font-medium">Начало:</span>
                  <span className="ml-2">{formatDateTime(event.start_time)}</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                  <span className="font-medium">Окончание:</span>
                  <span className="ml-2">{formatDateTime(event.end_time)}</span>
                </div>
              </div>
            </div>
            
            {/* Локация */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Локация</h3>
              <div className="flex items-start text-gray-600">
                <svg className="w-5 h-5 mr-2 mt-0.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25a7.5 7.5 0 1115 0z" />
                </svg>
                <span>{getLocationText()}</span>
              </div>
            </div>
            
            
            {/* Статус регистрации */}
            {event.participant_type === 'registration' && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Статус регистрации</h3>
                <div className="flex items-center">
                  {event.is_registered ? (
                    <>
                      <svg className="w-5 h-5 mr-2 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-green-600 font-medium">Вы подали заявку на это мероприятие</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span className="text-gray-600">Вы не подавали заявку на это мероприятие</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="flex justify-end p-6 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventModal;
