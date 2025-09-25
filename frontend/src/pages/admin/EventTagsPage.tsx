import { useParams } from 'react-router-dom';
import EventTagList from '../../components/eventTag/EventTagList';

const AdminEventTagsPage = () => {
  const { eventumSlug } = useParams<{ eventumSlug: string }>();

  if (!eventumSlug) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Не найден slug мероприятия</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Теги мероприятий</h2>
        <p className="text-gray-600">
          Управляйте тегами для категоризации мероприятий. Теги помогают организовать и фильтровать события.
        </p>
      </div>
      
      <EventTagList eventumSlug={eventumSlug} />
    </div>
  );
};

export default AdminEventTagsPage;
