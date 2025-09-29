const LocationsLoadingSkeleton = () => (
  <div className="space-y-4">
    <div className="flex items-center justify-between mb-4">
      <div className="h-5 w-40 rounded bg-gray-200 animate-pulse" />
      <div className="h-9 w-48 rounded-lg bg-gray-200 animate-pulse" />
    </div>

    {[...Array(3)].map((_, index) => (
      <div
        key={index}
        className="bg-white border border-gray-200 rounded-lg p-4"
      >
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 rounded-full bg-gray-200 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 rounded bg-gray-200 animate-pulse" />
            <div className="h-3 w-1/4 rounded bg-gray-200 animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            {[...Array(3)].map((__, buttonIndex) => (
              <div
                key={buttonIndex}
                className="h-8 w-8 rounded-lg bg-gray-200 animate-pulse"
              />
            ))}
          </div>
        </div>

        <div className="ml-6 mt-4 space-y-2">
          {[...Array(2)].map((__, childIndex) => (
            <div
              key={childIndex}
              className="flex items-center gap-3"
            >
              <div className="h-4 w-4 rounded bg-gray-200 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 rounded bg-gray-200 animate-pulse" />
                <div className="h-2 w-1/4 rounded bg-gray-200 animate-pulse" />
              </div>
              <div className="flex items-center gap-2">
                {[...Array(2)].map((___, childButtonIndex) => (
                  <div
                    key={childButtonIndex}
                    className="h-6 w-6 rounded bg-gray-200 animate-pulse"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

export default LocationsLoadingSkeleton;
