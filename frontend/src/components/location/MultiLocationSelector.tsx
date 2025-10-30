import { useState, useRef, useEffect } from 'react';
import type { Location } from '../../types';

interface MultiLocationSelectorProps {
  locations: Location[];
  selectedLocationIds: number[];
  onLocationChange: (locationIds: number[]) => void;
  placeholder?: string;
  className?: string;
}

// Функция для построения полного пути локации
const buildLocationPath = (location: Location, locations: Location[]): string => {
  const pathParts: string[] = [];
  
  const buildPathRecursive = (loc: Location) => {
    pathParts.unshift(loc.name);
    if (loc.parent) {
      const parentLocation = locations.find(l => l.id === loc.parent!.id);
      if (parentLocation) {
        buildPathRecursive(parentLocation);
      }
    }
  };
  
  buildPathRecursive(location);
  return pathParts.join(', ');
};

// Функция для поиска локаций по названию
const searchLocations = (locations: Location[], query: string): Location[] => {
  if (!query.trim()) return locations;
  
  const lowerQuery = query.toLowerCase();
  return locations.filter(location => {
    const fullPath = buildLocationPath(location, locations);
    return fullPath.toLowerCase().includes(lowerQuery);
  });
};

export const MultiLocationSelector: React.FC<MultiLocationSelectorProps> = ({
  locations,
  selectedLocationIds,
  onLocationChange,
  placeholder = "Выберите локации (необязательно)",
  className = ""
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Получаем выбранные локации
  const selectedLocations = locations.filter(loc => selectedLocationIds.includes(loc.id));
  
  // Получаем отфильтрованные локации для саджестов (исключаем уже выбранные)
  const filteredLocations = searchLocations(
    locations.filter(loc => !selectedLocationIds.includes(loc.id)), 
    searchQuery
  );

  // Обработка кликов вне области
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Обработка клавиш
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false);
      setIsFocused(false);
      inputRef.current?.blur();
    }
  };

  // Выбор локации
  const handleLocationSelect = (location: Location) => {
    const newLocationIds = [...selectedLocationIds, location.id];
    onLocationChange(newLocationIds);
    setSearchQuery("");
    setShowSuggestions(false);
  };

  // Удаление локации
  const handleLocationRemove = (locationId: number) => {
    const newLocationIds = selectedLocationIds.filter(id => id !== locationId);
    onLocationChange(newLocationIds);
  };

  // Очистка всех выбранных локаций
  const handleClearAll = () => {
    onLocationChange([]);
    setSearchQuery("");
    setShowSuggestions(false);
    setIsFocused(false);
  };

  // Получение отображаемого значения
  const getDisplayValue = () => {
    // Если пользователь вводит текст для поиска, показываем его
    if (isFocused && searchQuery) {
      return searchQuery;
    }
    // Если локации выбраны и пользователь не вводит текст, показываем количество
    if (selectedLocations.length > 0 && !searchQuery) {
      return `${selectedLocations.length} локаций выбрано`;
    }
    // В остальных случаях показываем поисковый запрос или пустую строку
    return searchQuery;
  };

  return (
    <div ref={containerRef} className={`relative space-y-2 ${className}`}>
      {/* Поле ввода для поиска */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          value={getDisplayValue()}
          onChange={(e) => {
            const value = e.target.value;
            setSearchQuery(value);
            setShowSuggestions(true);
            setIsFocused(true);
          }}
          onFocus={() => {
            setShowSuggestions(true);
            setIsFocused(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />

        {/* Кнопка очистки всех локаций */}
        {selectedLocations.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            title="Очистить все локации"
          >
            ×
          </button>
        )}

        {/* Саджесты */}
        {showSuggestions && isFocused && (
          <div className="absolute left-0 right-0 z-10 mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
            {filteredLocations.length > 0 ? (
              filteredLocations.map((location) => (
                <button
                  key={location.id}
                  type="button"
                  onClick={() => handleLocationSelect(location)}
                  className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50"
                >
                  <div className="font-medium">
                    {buildLocationPath(location, locations)}
                  </div>
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500">
                {searchQuery.trim() ? 'Локации не найдены' : 'Нет доступных локаций'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Показать выбранные локации */}
      {selectedLocations.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-gray-500">
            Выбранные локации:
          </div>
          <div className="flex flex-wrap gap-1">
            {selectedLocations.map((location) => (
              <span
                key={location.id}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
              >
                {buildLocationPath(location, locations)}
                <button
                  type="button"
                  onClick={() => handleLocationRemove(location.id)}
                  className="ml-1 text-blue-600 hover:text-blue-800"
                  title="Удалить локацию"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
