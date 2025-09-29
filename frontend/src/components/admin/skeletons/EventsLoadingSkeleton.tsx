const EventsLoadingSkeleton = () => (
  <div className="space-y-3">
    {[...Array(4)].map((_, index) => (
      <div
        key={index}
        className="rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm"
      >
        <div className="flex items-start justify-between gap-6">
          <div className="flex flex-col items-start gap-2 w-24 flex-shrink-0">
            <div className="h-3 w-20 rounded bg-gray-200 animate-pulse" />
            <div className="h-3 w-16 rounded bg-gray-200 animate-pulse" />
          </div>

          <div className="flex-1 space-y-3">
            <div className="h-5 w-1/2 rounded bg-gray-200 animate-pulse" />
            <div className="flex flex-wrap gap-2">
              {[...Array(3)].map((__, chipIndex) => (
                <div
                  key={chipIndex}
                  className="h-6 w-24 rounded-full bg-gray-200 animate-pulse"
                />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="h-3 w-32 rounded bg-gray-200 animate-pulse" />
              <div className="h-3 w-28 rounded bg-gray-200 animate-pulse" />
              <div className="h-3 w-20 rounded bg-gray-200 animate-pulse" />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {[...Array(2)].map((__, buttonIndex) => (
              <div
                key={buttonIndex}
                className="h-8 w-8 rounded-lg bg-gray-200 animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    ))}
  </div>
);

export default EventsLoadingSkeleton;
