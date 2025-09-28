import { useParams } from 'react-router-dom';
import { getSubdomainSlug } from '../utils/eventumSlug';

type EventumRouteParams = {
  eventumSlug?: string;
};

export const useEventumSlug = (): string | undefined => {
  const params = useParams<EventumRouteParams>();
  return params.eventumSlug ?? getSubdomainSlug() ?? undefined;
};
