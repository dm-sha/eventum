const WavesLoadingSkeleton = () => (
  <div className="space-y-4">
    {[...Array(3)].map((_, index) => (
      <div
        key={index}
        className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6"
      >
        <div className="space-y-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="h-5 w-48 rounded bg-gray-200 animate-pulse" />
              <div className="h-4 w-32 rounded bg-gray-200 animate-pulse" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gray-200 animate-pulse" />
              <div className="h-8 w-8 rounded-lg bg-gray-200 animate-pulse" />
            </div>
          </div>

          <div className="border-t pt-3">
            <div className="space-y-2 text-xs">
              <div className="h-3 w-64 rounded bg-gray-200 animate-pulse" />
              <div className="h-3 w-48 rounded bg-gray-200 animate-pulse" />
            </div>
          </div>

          <div className="border-t pt-3">
            <div className="h-4 w-32 rounded bg-gray-200 animate-pulse mb-2" />
            <div className="space-y-1">
              {[...Array(2)].map((__, eventIndex) => (
                <div
                  key={eventIndex}
                  className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="h-4 w-40 rounded bg-gray-200 animate-pulse" />
                  <div className="h-3 w-20 rounded bg-gray-200 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

export default WavesLoadingSkeleton;

