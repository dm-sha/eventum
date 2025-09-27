const ParticipantSkeleton = () => (
  <li className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
    {/* Аватарка участника слева */}
    <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse flex-shrink-0" />
    
    {/* Основная информация */}
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-1">
        {/* Имя участника */}
        <div className="h-4 bg-gray-200 rounded animate-pulse w-32" />
        {/* Ссылка на ВК */}
        <div className="h-3 bg-gray-200 rounded animate-pulse w-8" />
      </div>
      
      {/* Группы участника */}
      <div className="flex flex-wrap gap-1">
        <div className="h-5 bg-gray-200 rounded-full animate-pulse w-20" />
        <div className="h-5 bg-gray-200 rounded-full animate-pulse w-16" />
        <div className="h-5 bg-gray-200 rounded-full animate-pulse w-24" />
      </div>
    </div>
    
    {/* Кнопки действий справа */}
    <div className="flex items-center gap-2 flex-shrink-0">
      <div className="w-8 h-8 bg-gray-200 rounded-lg animate-pulse" />
      <div className="w-8 h-8 bg-gray-200 rounded-lg animate-pulse" />
    </div>
  </li>
);

export default ParticipantSkeleton;
