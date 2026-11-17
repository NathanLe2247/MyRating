import { CourtCard } from '@/components/play/court-card';
import { useCourtPhoto } from '@/hooks/use-court-photo';
import type { CourtCardData } from '@/types/play';

type NearbyCourtCardProps = {
  court: CourtCardData;
  /**
   * Fetch and show the court's photo. The list sets it only for the nearest
   * `CourtPhotoMaxCards` courts; without it the card makes no request.
   */
  showPhoto: boolean;
  onPress?: () => void;
};

// A court card that fetches its own Google Places photo (`useCourtPhoto`).
// Until the photo arrives, or when there is none, it's the plain card.
export function NearbyCourtCard({ court, showPhoto, onPress }: NearbyCourtCardProps) {
  const photo = useCourtPhoto(court, showPhoto);
  const withPhoto =
    showPhoto && photo
      ? { ...court, photoUrl: photo.photoUri, photoAttributions: photo.attributions }
      : court;
  return <CourtCard court={withPhoto} onPress={onPress} />;
}
