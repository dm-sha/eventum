import { useState } from 'react';
import type { Location } from '../../types';
import { IconChevronRight, IconChevronDown, IconPencil, IconTrash, IconPlus } from '../icons';

interface LocationTreeProps {
  locations: Location[];
  onEdit: (location: Location) => void;
  onDelete: (location: Location) => void;
  onAddChild: (parent: Location) => void;
  onAddRoot: () => void;
}

const KIND_LABELS = {
  venue: 'Площадка/Территория',
  building: 'Здание/Корпус',
  room: 'Аудитория/Кабинет',
  area: 'Зона/Outdoor',
  other: 'Другое'
} as const;


interface LocationNodeProps {
  location: Location;
  level: number;
  onEdit: (location: Location) => void;
  onDelete: (location: Location) => void;
  onAddChild: (parent: Location) => void;
}

const LocationNode: React.FC<LocationNodeProps> = ({
  location,
  level,
  onEdit,
  onDelete,
  onAddChild
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = location.children && location.children.length > 0;

  const handleToggle = () => {
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
  };

  const handleAddChild = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddChild(location);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(location);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(location);
  };

  return (
    <div className="select-none">
      
      <div
        className={`flex items-center gap-2 p-3 rounded-lg hover:bg-gray-50 cursor-pointer group border border-transparent hover:border-gray-200 transition-all ${
          level > 0 ? 'ml-4' : ''
        }`}
        style={{ paddingLeft: `${level * 16 + 12}px` }}
        onClick={handleToggle}
      >
        {/* Иконка раскрытия */}
        <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
          {hasChildren ? (
            isExpanded ? (
              <IconChevronDown size={14} className="text-gray-400" />
            ) : (
              <IconChevronRight size={14} className="text-gray-400" />
            )
          ) : (
            <div className="w-4 h-4"></div>
          )}
        </div>

        {/* Информация о локации */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-900 truncate">
              {location.name}
            </span>
            {(location.address) && (
              <span className="text-sm text-gray-500 truncate ml-4 text-right">
                {[location.address].filter(Boolean).join(', ')}
              </span>
            )}
          </div>
          
          <div className="text-xs text-gray-400 mt-1">
            {KIND_LABELS[location.kind]}
          </div>
        </div>

        {/* Кнопки действий */}
        <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleAddChild}
            className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            title="Добавить дочернюю локацию"
          >
            <IconPlus size={14} />
          </button>
          <button
            onClick={handleEdit}
            className="p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="Редактировать"
          >
            <IconPencil size={14} />
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Удалить"
          >
            <IconTrash size={14} />
          </button>
        </div>
      </div>

      {/* Дочерние локации */}
      {isExpanded && hasChildren && (
        <div className="space-y-2 mt-2">
          {location.children!.map((child, index) => (
            <div key={child.id}>
              <LocationNode
                location={child}
                level={level + 1}
                onEdit={onEdit}
                onDelete={onDelete}
                onAddChild={onAddChild}
              />
              {/* Разделитель между дочерними элементами */}
              {index < location.children!.length - 1 && (
                <div className="ml-4">
                  <div className="h-px bg-gray-100"></div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const LocationTree: React.FC<LocationTreeProps> = ({
  locations,
  onEdit,
  onDelete,
  onAddChild,
  onAddRoot
}) => {
  return (
    <div className="space-y-2">
      {/* Кнопка добавления корневой локации */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Дерево локаций</h3>
        <button
          onClick={onAddRoot}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <IconPlus size={14} />
          Добавить локацию
        </button>
      </div>

      {/* Список локаций */}
      {locations.length > 0 ? (
        <div className="space-y-4">
          {locations.map((location) => (
            <div key={location.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <LocationNode
                location={location}
                level={0}
                onEdit={onEdit}
                onDelete={onDelete}
                onAddChild={onAddChild}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-500">Локации не созданы</p>
        </div>
      )}
    </div>
  );
};
