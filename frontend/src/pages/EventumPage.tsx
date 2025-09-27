import { Link, useParams } from "react-router-dom";

const EventumPage = () => {
  const { eventumSlug } = useParams<{ eventumSlug: string }>();

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">

            <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              {eventumSlug}
            </h1>
          </div>
          <Link
            to={`/${eventumSlug}/admin`}
            className="inline-flex items-center justify-center rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Админка
          </Link>
        </div>

        <section className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
          <div className="px-4 py-6 sm:px-8 sm:py-8">
            <div className="text-center">
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
              <h2 className="mt-6 text-2xl font-bold text-gray-900">
                Скоро здесь будет полезная информация
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                На этой странице будет размещена вся необходимая информация для участников событий.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default EventumPage;