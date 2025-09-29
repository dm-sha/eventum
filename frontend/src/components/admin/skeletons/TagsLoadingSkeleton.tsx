const TagsLoadingSkeleton = () => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {[...Array(6)].map((_, index) => (
      <div
        key={index}
        className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="space-y-2 flex-1">
            <div className="h-5 w-2/3 rounded bg-gray-200 animate-pulse" />
            <div className="h-3 w-full rounded bg-gray-200 animate-pulse" />
          </div>
          <div className="h-8 w-8 rounded-lg bg-gray-200 animate-pulse" />
        </div>

        <div className="space-y-2">
          {[...Array(3)].map((__, itemIndex) => (
            <div
              key={itemIndex}
              className="flex items-center justify-between"
            >
              <div className="h-3 w-36 rounded bg-gray-200 animate-pulse" />
              <div className="h-6 w-6 rounded bg-gray-200 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

export default TagsLoadingSkeleton;
