const EventumInfoSkeleton = () => (
  <div className="space-y-6">
    <header className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-9 w-1/2 rounded bg-gray-200 animate-pulse" />
        <div className="h-9 w-24 rounded-lg bg-gray-200 animate-pulse" />
      </div>
    </header>

    <section className="space-y-3">
      <div className="flex items-center justify-end">
        <div className="h-8 w-8 rounded-lg bg-gray-200 animate-pulse" />
      </div>
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm space-y-3">
        {[...Array(3)].map((_, index) => (
          <div key={index} className="h-4 w-full rounded bg-gray-200 animate-pulse" />
        ))}
        <div className="h-4 w-1/2 rounded bg-gray-200 animate-pulse" />
      </div>
    </section>

    <section className="space-y-4">
      <div className="h-6 w-32 rounded bg-gray-200 animate-pulse" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[...Array(2)].map((_, index) => (
          <div
            key={index}
            className="bg-white border border-gray-200 rounded-lg p-4"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gray-200 animate-pulse" />
              <div className="space-y-2">
                <div className="h-3 w-20 rounded bg-gray-200 animate-pulse" />
                <div className="h-5 w-16 rounded bg-gray-200 animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>

    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 rounded-full bg-gray-200 animate-pulse" />
        <div className="h-6 w-32 rounded bg-gray-200 animate-pulse" />
      </div>
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 w-32 rounded bg-gray-200 animate-pulse" />
          <div className="h-9 w-32 rounded-lg bg-gray-200 animate-pulse" />
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, index) => (
            <div
              key={index}
              className="flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse" />
                <div className="space-y-2">
                  <div className="h-4 w-32 rounded bg-gray-200 animate-pulse" />
                  <div className="h-3 w-24 rounded bg-gray-200 animate-pulse" />
                </div>
              </div>
              <div className="h-8 w-8 rounded-lg bg-gray-200 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </section>
  </div>
);

export default EventumInfoSkeleton;
