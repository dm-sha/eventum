import ParticipantSkeleton from "./ParticipantSkeleton";

const ParticipantsLoadingSkeleton = () => (
  <ul className="space-y-3">
    {Array.from({ length: 6 }).map((_, index) => (
      <ParticipantSkeleton key={index} />
    ))}
  </ul>
);

export default ParticipantsLoadingSkeleton;
