import { CourtCard } from '@/components/play/court-card';
import { useCourtPhoto } from '@/hooks/use-court-photo';
import type { CourtCardData } from '@/types/play';

type NearbyCourtCardProps = {
  court: CourtCardData;
  onPress?: () => void;
};

// A court card that fetches its own Google Places photo (`useCourtPhoto`).
// Until the photo arrives, or when there is none, it's the plain card.
export function NearbyCourtCard({ court, onPress }: NearbyCourtCardProps) {
  const photo = useCourtPhoto(court);
  const withPhoto = photo
    ? { ...court, photoUrl: photo.photoUri, photoAttributions: photo.attributions }
    : court;
  return <CourtCard court={withPhoto} onPress={onPress} />;
}
