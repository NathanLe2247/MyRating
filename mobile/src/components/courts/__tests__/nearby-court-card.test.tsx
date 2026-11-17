import { FunctionsHttpError } from '@supabase/supabase-js';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { NearbyCourtCard } from '@/components/courts/nearby-court-card';
import { NearbyCourtsSection } from '@/components/courts/nearby-courts-section';
import { useSupabaseClient } from '@/config/supabase';
import { CourtPhotoMaxCards } from '@/constants/courts';
import { en } from '@/i18n/en';
import { renderWithQueryClient as render } from '@/test-utils/query-client';
import type { CourtCardData } from '@/types/play';

const copy = en.play.courts;

jest.mock('@/config/supabase', () => ({ useSupabaseClient: jest.fn() }));
// The native image view, as a plain View carrying the props, so a test can
// find it by its label and fire its load error.
jest.mock('expo-image', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { Image: (props: object) => <View {...props} /> };
});

const invoke = jest.fn();
(useSupabaseClient as jest.Mock).mockReturnValue({ functions: { invoke } });

const court: CourtCardData = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Anchor Park Courts',
  distanceMiles: '0.7',
  location: { lat: 39.1, lng: -76.9 },
  googlePlaceId: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
  tags: [],
};

const photoUri = 'https://lh3.googleusercontent.com/places/photo-1';
const photo = (uri: string | null = 'https://maps.google.com/maps/contrib/1') => ({
  photoUri,
  attributions: [{ displayName: 'Jane Doe', uri }],
});
const httpError = (error: string) =>
  new FunctionsHttpError({ json: async () => ({ error }) });

const image = () => screen.queryByLabelText(copy.a11y.photo(court.name));
const credit = copy.photoCredit('Jane Doe');

/**
 * Lets the photo query finish, whatever it resolved to. React Query tells
 * observers on a 0 ms timer, so wait past it inside act.
 */
async function settle() {
  await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
  await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
}

describe('NearbyCourtCard', () => {
  afterEach(() => invoke.mockReset());

  it('shows the photo above the card with its linked Google credit', async () => {
    invoke.mockResolvedValue({ data: photo(), error: null });
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    render(<NearbyCourtCard court={court} showPhoto />);

    const shown = await screen.findByLabelText(copy.a11y.photo(court.name));
    expect(shown).toHaveProp('source', { uri: photoUri });
    expect(invoke).toHaveBeenCalledWith(`court-photo?court_id=${court.id}`, { method: 'GET' });
    // Google requires a "Google Maps" source label next to Places content.
    expect(screen.getByText(copy.photoSource)).toBeOnTheScreen();
    const link = screen.getByRole('link', { name: credit });
    expect(link).toHaveProp('accessibilityHint', copy.a11y.photoCreditHint);
    fireEvent.press(link);
    expect(openURL).toHaveBeenCalledWith('https://maps.google.com/maps/contrib/1');
    expect(screen.getByRole('button', { name: court.name })).toBeOnTheScreen();
    openURL.mockRestore();
  });

  // Google's terms forbid storing Places photos; expo-image's default
  // ('disk') would keep them on the device across restarts.
  it('keeps the photo in the memory image cache only', async () => {
    invoke.mockResolvedValue({ data: photo(), error: null });
    render(<NearbyCourtCard court={court} showPhoto />);

    expect(await screen.findByLabelText(copy.a11y.photo(court.name))).toHaveProp(
      'cachePolicy',
      'memory',
    );
  });

  it('gives a credit link a touch target at least 44pt tall', async () => {
    invoke.mockResolvedValue({ data: photo(), error: null });
    render(<NearbyCourtCard court={court} showPhoto />);

    const { hitSlop } = (await screen.findByRole('link', { name: credit })).props;
    expect(14 + hitSlop.top + hitSlop.bottom).toBeGreaterThanOrEqual(44);
  });

  it('shows an unlinked credit when the author has no page', async () => {
    invoke.mockResolvedValue({ data: photo(null), error: null });
    render(<NearbyCourtCard court={court} showPhoto />);

    expect(await screen.findByText(credit)).toBeOnTheScreen();
    expect(screen.queryByRole('link', { name: credit })).toBeNull();
  });

  it('renders the plain card while the photo loads', () => {
    invoke.mockReturnValue(new Promise(() => {}));
    render(<NearbyCourtCard court={court} showPhoto />);

    expect(screen.getByRole('button', { name: court.name })).toBeOnTheScreen();
    expect(image()).toBeNull();
    expect(screen.queryByText(credit)).toBeNull();
  });

  it.each(['not_found', 'unavailable', 'upstream_error', 'internal_error'])(
    'renders the plain card on a %s answer',
    async (code) => {
      invoke.mockResolvedValue({ data: null, error: httpError(code) });
      render(<NearbyCourtCard court={court} showPhoto />);
      await settle();

      expect(screen.getByRole('button', { name: court.name })).toBeOnTheScreen();
      expect(image()).toBeNull();
      expect(screen.queryByText(credit)).toBeNull();
      expect(screen.queryByText(copy.photoSource)).toBeNull();
    },
  );

  it('renders the plain card when the request fails outright', async () => {
    invoke.mockRejectedValue(new Error('offline'));
    render(<NearbyCourtCard court={court} showPhoto />);
    await settle();

    expect(screen.getByRole('button', { name: court.name })).toBeOnTheScreen();
    expect(image()).toBeNull();
  });

  // A 502 can come after Place Details already spent a capped Google call,
  // so a failure is kept like a 404 instead of being asked again.
  it('does not ask again when a card remounts after a failure', async () => {
    invoke.mockResolvedValue({ data: null, error: httpError('upstream_error') });
    const { rerender } = render(<NearbyCourtCard key="first" court={court} showPhoto />);
    await settle();

    rerender(<NearbyCourtCard key="second" court={court} showPhoto />);
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(image()).toBeNull();
  });

  it('renders the plain card when the answer does not parse', async () => {
    invoke.mockResolvedValue({ data: { photoUri: 'not a url', attributions: [] }, error: null });
    render(<NearbyCourtCard court={court} showPhoto />);
    await settle();

    expect(image()).toBeNull();
  });

  it('asks for nothing when the court has no Place ID', async () => {
    render(<NearbyCourtCard court={{ ...court, googlePlaceId: undefined }} showPhoto />);
    await act(async () => {});

    expect(invoke).not.toHaveBeenCalled();
    expect(image()).toBeNull();
  });

  it('asks for nothing when the list did not pick it for a photo', async () => {
    render(<NearbyCourtCard court={court} showPhoto={false} />);
    await act(async () => {});

    expect(invoke).not.toHaveBeenCalled();
    expect(image()).toBeNull();
  });

  it('drops the photo and its credit when the image fails to load', async () => {
    invoke.mockResolvedValue({ data: photo(), error: null });
    render(<NearbyCourtCard court={court} showPhoto />);
    const loaded = await screen.findByLabelText(copy.a11y.photo(court.name));

    fireEvent(loaded, 'error', { error: 'expired' });

    expect(image()).toBeNull();
    expect(screen.queryByText(credit)).toBeNull();
    expect(screen.getByRole('button', { name: court.name })).toBeOnTheScreen();
  });
});

describe('NearbyCourtsSection photos', () => {
  afterEach(() => invoke.mockReset());

  it(`fetches photos for the nearest ${CourtPhotoMaxCards} courts only`, async () => {
    invoke.mockResolvedValue({ data: photo(), error: null });
    // Nearest first, as useNearbyCourts lists them; every one has a Place ID.
    const courts = Array.from({ length: CourtPhotoMaxCards + 1 }, (_, i) => ({
      ...court,
      id: `00000000-0000-4000-8000-00000000000${i}`,
      name: `Court ${i + 1}`,
    }));
    render(<NearbyCourtsSection state={{ status: 'loaded', courts }} />);

    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(CourtPhotoMaxCards));
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));

    const last = courts[CourtPhotoMaxCards];
    expect(invoke).toHaveBeenCalledTimes(CourtPhotoMaxCards);
    expect(invoke).not.toHaveBeenCalledWith(`court-photo?court_id=${last.id}`, expect.anything());
    expect(screen.getByLabelText(copy.a11y.photo(courts[0].name))).toBeOnTheScreen();
    expect(screen.queryByLabelText(copy.a11y.photo(last.name))).toBeNull();
    expect(screen.getByRole('button', { name: last.name })).toBeOnTheScreen();
  });
});
