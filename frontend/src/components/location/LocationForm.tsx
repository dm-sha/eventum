import { useState, useEffect } from 'react';
import { getValidParents } from '../../api/location';
import type { Location, CreateLocationData } from '../../types';
import { IconX } from '../icons';

interface LocationFormProps {
  eventumSlug: string;
  location?: Location;
  parentLocation?: Location;
  onSave: (data: CreateLocationData) => Promise<void>;
  onCancel: () => void;
  isOpen: boolean;
}

const KIND_OPTIONS = [
  { value: 'venue', label: 'Площадка/Территория' },
  { value: 'building', label: 'Здание/Корпус' },
  { value: 'room', label: 'Аудитория/Кабинет' },
  { value: 'area', label: 'Зона/Outdoor' },
  { value: 'other', label: 'Другое' }
] as const;

export const LocationForm: React.FC<LocationFormProps> = ({
  eventumSlug,
  location,
  parentLocation,
  onSave,
  onCancel,
  isOpen
}) => {
  const [formData, setFormData] = useState<CreateLocationData>({
    name: '',
    kind: 'room',
    address: '',
    floor: '',
    notes: '',
    parent_id: null
  });
  
  const [validParents, setValidParents] = useState<Location[]>([]);
  const [isLoadingParents, setIsLoadingParents] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string>('');

  // Функция для определения следующего типа по иерархии
  const getNextKindInHierarchy = (parentKind: string): string => {
    const hierarchyMap: Record<string, string[]> = {
      'venue': ['building', 'area', 'other'],
      'building': ['room', 'area', 'other'],
      'room': ['other'],
      'area': ['other'],
      'other': []
    };
    
    const possibleKinds = hierarchyMap[parentKind] || [];
    return possibleKinds[0] || 'other'; // По умолчанию 'other' если нет вариантов
  };

  useEffect(() => {
    if (isOpen) {
      if (location) {
        // Редактирование существующей локации
        setFormData({
          name: location.name,
          kind: location.kind,
          address: location.address || '',
          floor: location.floor || '',
          notes: location.notes || '',
          parent_id: location.parent_id || null
        });
      } else {
        // Создание новой локации
        const defaultKind = parentLocation ? getNextKindInHierarchy(parentLocation.kind) : 'room';
        setFormData({
          name: '',
          kind: defaultKind as any,
          address: '',
          floor: '',
          notes: '',
          parent_id: parentLocation?.id || null
        });
      }
      setErrors({});
      setApiError('');
    }
  }, [isOpen, location, parentLocation]);

  useEffect(() => {
    if (isOpen && formData.kind) {
      loadValidParents();
    }
  }, [isOpen, formData.kind]);

  const loadValidParents = async () => {
    setIsLoadingParents(true);
    try {
      const parents = await getValidParents(eventumSlug, formData.kind, location?.id);
      setValidParents(parents);
    } catch (error) {
      console.error('Ошибка загрузки валидных родителей:', error);
      setValidParents([]);
    } finally {
      setIsLoadingParents(false);
    }
  };

  const handleInputChange = (field: keyof CreateLocationData, value: string | number | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Очищаем ошибку для этого поля
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
    // Очищаем общую ошибку API
    if (apiError) {
      setApiError('');
    }
  };

  const handleKindChange = (kind: string) => {
    setFormData(prev => ({ ...prev, kind: kind as any, parent_id: null }));
    setValidParents([]);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Название обязательно';
    }

    if (!formData.kind) {
      newErrors.kind = 'Тип локации обязателен';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    setApiError('');
    try {
      await onSave(formData);
    } catch (error: any) {
      console.error('Ошибка сохранения локации:', error);
      
      // Обрабатываем различные типы ошибок
      if (error.response?.data) {
        const errorData = error.response.data;
        
        // Обрабатываем ошибки валидации полей
        if (typeof errorData === 'object' && !Array.isArray(errorData)) {
          const fieldErrors: Record<string, string> = {};
          Object.keys(errorData).forEach(key => {
            if (Array.isArray(errorData[key])) {
              fieldErrors[key] = errorData[key][0];
            } else {
              fieldErrors[key] = errorData[key];
            }
          });
          setErrors(fieldErrors);
        } else if (typeof errorData === 'string') {
          setApiError(errorData);
        } else {
          setApiError('Произошла ошибка при сохранении локации');
        }
      } else if (error.message) {
        setApiError(error.message);
      } else {
        setApiError('Произошла неизвестная ошибка');
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {location ? 'Редактировать локацию' : 'Создать локацию'}
            </h3>
            {parentLocation && !location && (
              <p className="text-sm text-gray-500 mt-1">
                Родительская локация: <span className="font-medium">{parentLocation.name}</span>
              </p>
            )}
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <IconX size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Общая ошибка API */}
          {apiError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{apiError}</p>
            </div>
          )}

          {/* Название */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Название *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                errors.name 
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
              }`}
              placeholder="Введите название локации"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name}</p>
            )}
          </div>

          {/* Тип локации */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Тип локации *
            </label>
            <select
              value={formData.kind}
              onChange={(e) => handleKindChange(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                errors.kind 
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
              }`}
            >
              {KIND_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.kind && (
              <p className="mt-1 text-sm text-red-600">{errors.kind}</p>
            )}
          </div>

          {/* Родительская локация */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Родительская локация
            </label>
            {isLoadingParents ? (
              <div className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-500">
                Загрузка...
              </div>
            ) : (
              <select
                value={formData.parent_id || ''}
                onChange={(e) => handleInputChange('parent_id', e.target.value ? parseInt(e.target.value) : null)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-200"
              >
                <option value="">Без родительской локации</option>
                {validParents.map(parent => (
                  <option key={parent.id} value={parent.id}>
                    {parent.name} ({KIND_OPTIONS.find(k => k.value === parent.kind)?.label})
                  </option>
                ))}
              </select>
            )}
            {validParents.length === 0 && !isLoadingParents && formData.kind !== 'venue' && (
              <p className="mt-1 text-sm text-gray-500">
                Нет доступных родительских локаций для выбранного типа
              </p>
            )}
          </div>

          {/* Адрес */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Адрес
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-200"
              placeholder="Введите адрес локации"
            />
          </div>

          {/* Этаж */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Этаж
            </label>
            <input
              type="text"
              value={formData.floor}
              onChange={(e) => handleInputChange('floor', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-200"
              placeholder="Например: 1, 2, подвал, чердак"
            />
          </div>

          {/* Заметки */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Заметки
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-200"
              rows={3}
              placeholder="Дополнительная информация о локации"
            />
          </div>

          {/* Кнопки */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Отменить
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Сохранение...' : (location ? 'Сохранить' : 'Создать')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
