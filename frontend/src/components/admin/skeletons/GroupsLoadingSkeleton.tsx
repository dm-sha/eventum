const GroupsLoadingSkeleton = () => (
  <div
    className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    style={{ gridAutoRows: 'min-content', alignItems: 'start' as const }}
  >
    {[...Array(6)].map((_, index) => (
      <div
        key={index}
        className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="space-y-2 w-full">
            <div className="h-5 w-2/3 rounded bg-gray-200 animate-pulse" />
            <div className="flex flex-wrap gap-2">
              {[...Array(2)].map((__, tagIndex) => (
                <div
                  key={tagIndex}
                  className="h-5 w-20 rounded-full bg-gray-200 animate-pulse"
                />
              ))}
            </div>
          </div>
          <div className="ml-4 h-8 w-8 rounded-lg bg-gray-200 animate-pulse" />
        </div>

        <div className="space-y-2">
          {[...Array(3)].map((__, participantIndex) => (
            <div
              key={participantIndex}
              className="flex items-center justify-between"
            >
              <div className="h-3 w-32 rounded bg-gray-200 animate-pulse" />
              <div className="h-6 w-6 rounded bg-gray-200 animate-pulse" />
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <div className="h-8 flex-1 rounded-lg bg-gray-200 animate-pulse" />
          <div className="h-8 flex-1 rounded-lg bg-gray-200 animate-pulse" />
        </div>
      </div>
    ))}
  </div>
);

export default GroupsLoadingSkeleton;
