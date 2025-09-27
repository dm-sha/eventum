import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { 
  getLocationTree, 
  createLocation, 
  updateLocation, 
  deleteLocation 
} from '../../api/location';
import { LocationTree } from '../../components/location/LocationTree';
import { LocationForm } from '../../components/location/LocationForm';
import { IconInformationCircle } from '../../components/icons';
import type { Location, CreateLocationData } from '../../types';

const LocationsPage = () => {
  const { eventumSlug } = useParams();
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [parentLocation, setParentLocation] = useState<Location | null>(null);

  useEffect(() => {
    if (eventumSlug) {
      loadLocations();
    }
  }, [eventumSlug]);

  const loadLocations = async () => {
    if (!eventumSlug) return;
    
    setIsLoading(true);
    try {
      const locationTree = await getLocationTree(eventumSlug);
      setLocations(locationTree);
    } catch (error) {
      console.error('Ошибка загрузки локаций:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateLocation = async (data: CreateLocationData) => {
    if (!eventumSlug) return;

    try {
      await createLocation(eventumSlug, data);
      await loadLocations(); // Перезагружаем дерево
      setIsFormOpen(false);
      setEditingLocation(null);
      setParentLocation(null);
    } catch (error: any) {
      console.error('Ошибка создания локации:', error);
      
      // Обрабатываем специфичные ошибки
      if (error.response?.status === 400) {
        // Ошибки валидации - пробрасываем для отображения в форме
        throw error;
      } else if (error.response?.status === 500) {
        // Серверные ошибки
        alert('Произошла ошибка сервера. Попробуйте еще раз.');
        throw error;
      } else {
        // Другие ошибки
        alert('Не удалось создать локацию. Проверьте данные и попробуйте еще раз.');
        throw error;
      }
    }
  };

  const handleUpdateLocation = async (data: CreateLocationData) => {
    if (!eventumSlug || !editingLocation) return;

    try {
      await updateLocation(eventumSlug, editingLocation.id, data);
      await loadLocations(); // Перезагружаем дерево
      setIsFormOpen(false);
      setEditingLocation(null);
      setParentLocation(null);
    } catch (error: any) {
      console.error('Ошибка обновления локации:', error);
      
      // Обрабатываем специфичные ошибки
      if (error.response?.status === 400) {
        // Ошибки валидации - пробрасываем для отображения в форме
        throw error;
      } else if (error.response?.status === 500) {
        // Серверные ошибки
        alert('Произошла ошибка сервера. Попробуйте еще раз.');
        throw error;
      } else {
        // Другие ошибки
        alert('Не удалось обновить локацию. Проверьте данные и попробуйте еще раз.');
        throw error;
      }
    }
  };

  const handleDeleteLocation = async (location: Location) => {
    if (!eventumSlug) return;

    const hasChildren = location.children && location.children.length > 0;
    const confirmMessage = hasChildren 
      ? `Вы уверены, что хотите удалить локацию "${location.name}" и все её дочерние локации?`
      : `Вы уверены, что хотите удалить локацию "${location.name}"?`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      await deleteLocation(eventumSlug, location.id);
      await loadLocations(); // Перезагружаем дерево
    } catch (error: any) {
      console.error('Ошибка удаления локации:', error);
      
      if (error.response?.status === 400) {
        alert('Не удалось удалить локацию. Возможно, она используется в мероприятиях или имеет дочерние локации.');
      } else if (error.response?.status === 500) {
        alert('Произошла ошибка сервера. Попробуйте еще раз.');
      } else {
        alert('Не удалось удалить локацию. Попробуйте еще раз.');
      }
    }
  };

  const handleEditLocation = (location: Location) => {
    setEditingLocation(location);
    setParentLocation(null);
    setIsFormOpen(true);
  };

  const handleAddChild = (parent: Location) => {
    setParentLocation(parent);
    setEditingLocation(null);
    setIsFormOpen(true);
  };

  const handleAddRoot = () => {
    setParentLocation(null);
    setEditingLocation(null);
    setIsFormOpen(true);
  };

  const handleFormCancel = () => {
    setIsFormOpen(false);
    setEditingLocation(null);
    setParentLocation(null);
  };

  const handleFormSave = async (data: CreateLocationData) => {
    if (editingLocation) {
      await handleUpdateLocation(data);
    } else {
      // При создании новой локации учитываем родительскую
      const locationData = {
        ...data,
        parent_id: parentLocation?.id || null
      };
      await handleCreateLocation(locationData);
    }
  };

  const LoadingSpinner = () => (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-semibold text-gray-900">Локации</h2>
          <div className="group relative">
            <IconInformationCircle size={20} className="text-gray-400 cursor-help" />
            <div className="absolute top-full left-0 mt-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-normal w-80 z-50">
              Управляйте локациями для проведения мероприятий. Создавайте иерархическую структуру: площадка → корпус → аудитория.
            </div>
          </div>
        </div>
      </header>

      <LocationTree
        locations={locations}
        onEdit={handleEditLocation}
        onDelete={handleDeleteLocation}
        onAddChild={handleAddChild}
        onAddRoot={handleAddRoot}
      />

      <LocationForm
        eventumSlug={eventumSlug!}
        location={editingLocation || undefined}
        parentLocation={parentLocation || undefined}
        onSave={handleFormSave}
        onCancel={handleFormCancel}
        isOpen={isFormOpen}
      />
    </div>
  );
};

export default LocationsPage;
