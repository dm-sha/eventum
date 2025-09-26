import { useParams } from 'react-router-dom';
import GroupTagList from '../../components/groupTag/GroupTagList';

const AdminGroupTagsPage = () => {
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
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Теги групп</h2>
        <p className="text-gray-600">
          Управляйте тегами для категоризации групп участников. Теги помогают организовать и фильтровать группы.
        </p>
      </div>
      
      <GroupTagList eventumSlug={eventumSlug} />
    </div>
  );
};

export default AdminGroupTagsPage;
