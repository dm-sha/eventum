import { Link, useParams } from "react-router-dom";

const EventumPage = () => {
  const { eventumSlug } = useParams<{ eventumSlug: string }>();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-wide text-blue-600">eventum</p>
          <h1 className="text-balance text-3xl font-bold text-gray-900 sm:text-4xl">
            {eventumSlug}
          </h1>
          <p className="text-sm text-gray-600">
            Страница для участников с расписанием, материалами и объявлениями появится здесь позже.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          <Link
            to={`/${eventumSlug}/admin`}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75v10.5m5.25-5.25H6.75" />
            </svg>
            Админка
          </Link>
          <span className="text-xs text-gray-400">Доступна только организаторам</span>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-dashed border-gray-200 bg-white/80 p-6 text-center shadow-sm backdrop-blur-sm sm:p-10">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-blue-100">
          <svg
            className="h-12 w-12 text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
            />
          </svg>
        </div>
        <h2 className="mt-6 text-2xl font-bold text-gray-900 sm:text-3xl">
          Скоро здесь будет полезная информация
        </h2>
        <p className="mt-4 text-base leading-relaxed text-gray-600">
          Мы готовим подробную страницу с расписанием, материалами и важными объявлениями. Следите за обновлениями — мы обязательно уведомим участников, когда все будет готово.
        </p>
      </section>
    </div>
  );
};

export default EventumPage;