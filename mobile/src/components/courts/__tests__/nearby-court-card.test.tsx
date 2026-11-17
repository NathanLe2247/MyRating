import { FunctionsHttpError } from '@supabase/supabase-js';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { NearbyCourtCard } from '@/components/courts/nearby-court-card';
import { useSupabaseClient } from '@/config/supabase';
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
    render(<NearbyCourtCard court={court} />);

    expect(await screen.findByLabelText(copy.a11y.photo(court.name))).toHaveProp('source', {
      uri: photoUri,
    });
    expect(invoke).toHaveBeenCalledWith(`court-photo?court_id=${court.id}`, { method: 'GET' });
    fireEvent.press(screen.getByRole('link', { name: credit }));
    expect(openURL).toHaveBeenCalledWith('https://maps.google.com/maps/contrib/1');
    expect(screen.getByRole('button', { name: court.name })).toBeOnTheScreen();
    openURL.mockRestore();
  });

  it('shows an unlinked credit when the author has no page', async () => {
    invoke.mockResolvedValue({ data: photo(null), error: null });
    render(<NearbyCourtCard court={court} />);

    expect(await screen.findByText(credit)).toBeOnTheScreen();
    expect(screen.queryByRole('link', { name: credit })).toBeNull();
  });

  it('renders the plain card while the photo loads', () => {
    invoke.mockReturnValue(new Promise(() => {}));
    render(<NearbyCourtCard court={court} />);

    expect(screen.getByRole('button', { name: court.name })).toBeOnTheScreen();
    expect(image()).toBeNull();
    expect(screen.queryByText(credit)).toBeNull();
  });

  it.each(['not_found', 'unavailable', 'upstream_error'])(
    'renders the plain card on a %s answer',
    async (code) => {
      invoke.mockResolvedValue({ data: null, error: httpError(code) });
      render(<NearbyCourtCard court={court} />);
      await settle();

      expect(screen.getByRole('button', { name: court.name })).toBeOnTheScreen();
      expect(image()).toBeNull();
      expect(screen.queryByText(credit)).toBeNull();
    },
  );

  it('renders the plain card when the answer does not parse', async () => {
    invoke.mockResolvedValue({ data: { photoUri: 'not a url', attributions: [] }, error: null });
    render(<NearbyCourtCard court={court} />);
    await settle();

    expect(image()).toBeNull();
  });

  it('asks for nothing when the court has no Place ID', async () => {
    render(<NearbyCourtCard court={{ ...court, googlePlaceId: undefined }} />);
    await act(async () => {});

    expect(invoke).not.toHaveBeenCalled();
    expect(image()).toBeNull();
  });

  it('drops the photo and its credit when the image fails to load', async () => {
    invoke.mockResolvedValue({ data: photo(), error: null });
    render(<NearbyCourtCard court={court} />);
    const loaded = await screen.findByLabelText(copy.a11y.photo(court.name));

    fireEvent(loaded, 'error', { error: 'expired' });

    expect(image()).toBeNull();
    expect(screen.queryByText(credit)).toBeNull();
    expect(screen.getByRole('button', { name: court.name })).toBeOnTheScreen();
  });
});
