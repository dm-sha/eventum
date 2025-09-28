import React, { useState } from 'react';
import { IconInformationCircle } from './icons';
import { checkSlugAvailability } from '../api/eventum';

interface CreateEventumModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; slug: string }) => void;
}

const CreateEventumModal: React.FC<CreateEventumModalProps> = ({
  isOpen,
  onClose,
  onSubmit
}) => {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slugError, setSlugError] = useState('');

  // Функция для генерации slug из названия
  const generateSlug = (text: string): string => {
    return text
      .toLowerCase()
      .replace(/[а-яё]/g, (char) => {
        const map: { [key: string]: string } = {
          'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
          'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
          'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
          'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
          'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
        };
        return map[char] || char;
      })
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  // Обработка изменения названия
  const handleNameChange = (value: string) => {
    setName(value);
    // Автоматически генерируем slug из названия
    setSlug(generateSlug(value));
  };

  // Обработка изменения slug
  const handleSlugChange = (value: string) => {
    setSlug(value);
    setSlugError(''); // Очищаем ошибку при изменении
  };

  // Обработка отправки формы
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      alert('Пожалуйста, введите название события');
      return;
    }

    if (!slug.trim()) {
      alert('Пожалуйста, введите slug');
      return;
    }

    const finalSlug = slug.trim();

    // Проверяем доступность slug
    try {
      const isAvailable = await checkSlugAvailability(finalSlug);
      if (!isAvailable) {
        setSlugError('Этот slut уже занят. Попробуйте другой.');
        return;
      }
    } catch (error) {
      console.error('Ошибка проверки slug:', error);
      setSlugError('Ошибка проверки slut. Попробуйте еще раз.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        slug: finalSlug
      });
      
      // Сброс формы
      setName('');
      setSlug('');
      setSlugError('');
      onClose();
    } catch (error) {
      console.error('Ошибка создания события:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Обработка закрытия модального окна
  const handleClose = () => {
    if (!isSubmitting) {
      setName('');
      setSlug('');
      setSlugError('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}>
      <div className="w-full max-w-md mx-4 bg-white rounded-xl shadow-lg pointer-events-auto">
        
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Создать новое событие
          </h3>
          
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              {/* Название */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Название события *
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                  placeholder="Введите название события"
                  required
                />
              </div>

              {/* Slug */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label htmlFor="slug" className="text-sm font-medium text-gray-700">
                    slug *
                  </label>
                  <div className="group relative">
                    <IconInformationCircle size={16} className="text-gray-400 cursor-help" />
                    <div className="absolute top-full left-0 mt-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-normal w-80 z-50">
                      Это часть URL-адреса вашего события. Например, для события "Слёт 2025" slug может быть "slet25". Используется для создания красивых ссылок.
                    </div>
                  </div>
                </div>
                <input
                  type="text"
                  id="slug"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  disabled={isSubmitting}
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 disabled:bg-gray-50 disabled:text-gray-500 ${
                    slugError 
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                  }`}
                  required
                />
                {slugError && (
                  <p className="mt-1 text-xs text-red-600">{slugError}</p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !name.trim() || !slug.trim() || !!slugError}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {isSubmitting ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateEventumModal;
