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
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-gray-900">Теги групп</h2>
        <p className="text-sm text-gray-500">
          Управляйте тегами для категоризации групп участников. Теги помогают организовать и фильтровать группы.
        </p>
      </header>

      <GroupTagList eventumSlug={eventumSlug} />
    </div>
  );
};

export default AdminGroupTagsPage;
