import { useState, useRef, useEffect } from 'react';
import type { Location } from '../../types';

interface LocationSelectorProps {
  locations: Location[];
  selectedLocationId?: number;
  onLocationChange: (locationId: number | undefined) => void;
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

export const LocationSelector: React.FC<LocationSelectorProps> = ({
  locations,
  selectedLocationId,
  onLocationChange,
  placeholder = "Выберите локацию (необязательно)",
  className = ""
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Получаем выбранную локацию
  const selectedLocation = locations.find(loc => loc.id === selectedLocationId);
  
  // Получаем отфильтрованные локации для саджестов
  const filteredLocations = searchLocations(locations, searchQuery);

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
    onLocationChange(location.id);
    setSearchQuery("");
    setShowSuggestions(false);
    setIsFocused(false);
  };

  // Очистка выбора
  const handleClear = () => {
    onLocationChange(undefined);
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
    // Если локация выбрана и пользователь не вводит текст, показываем полный путь
    if (selectedLocation && !searchQuery) {
      return buildLocationPath(selectedLocation, locations);
    }
    // В остальных случаях показываем поисковый запрос или пустую строку
    return searchQuery;
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
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
            
            // Если пользователь начал вводить текст и раньше была выбрана локация,
            // сбрасываем выбор, чтобы позволить поиск
            if (value && selectedLocation) {
              onLocationChange(undefined);
            }
          }}
          onFocus={() => {
            setShowSuggestions(true);
            setIsFocused(true);
            // Если поле в фокусе и есть выбранная локация, очищаем поле для ввода
            if (selectedLocation && !searchQuery) {
              setSearchQuery("");
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        
        {/* Кнопка очистки */}
        {selectedLocation && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        )}
      </div>

      {/* Саджесты */}
      {showSuggestions && isFocused && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto">
          {filteredLocations.length > 0 ? (
            filteredLocations.map((location) => (
              <button
                key={location.id}
                type="button"
                onClick={() => handleLocationSelect(location)}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors ${
                  selectedLocationId === location.id ? 'bg-blue-50 text-blue-900' : ''
                }`}
              >
                <div className="font-medium">
                  {buildLocationPath(location, locations)}
                </div>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-gray-500">
              Локации не найдены
            </div>
          )}
        </div>
      )}
    </div>
  );
};
