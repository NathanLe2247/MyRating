import { act, render, screen } from '@testing-library/react-native';
import { Image } from 'expo-image';

import { PlayerAvatar } from '@/components/match-found/player-avatar';

type ImageLoad = { uri: string; fail: (error: { error: string }) => void };

const loads: ImageLoad[] = [];

// Models the native image view: each mounted view starts a load for the URL it was mounted
// with, a late failure is delivered to whatever onError the view holds at that moment, and a
// view that has been unmounted never delivers events.
jest.mock('expo-image', () => {
  const { useEffect, useRef } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  function MockImage(props: { source: { uri: string }; onError?: (e: unknown) => void }) {
    const latest = useRef(props);
    latest.current = props;
    useEffect(() => {
      let mounted = true;
      loads.push({
        uri: latest.current.source.uri,
        fail: (error) => {
          if (mounted) latest.current.onError?.(error);
        },
      });
      return () => {
        mounted = false;
      };
    }, []);
    return <View />;
  }
  return { Image: MockImage };
});

// Treat every URL as an R2 photo so the avatar takes the photo branch.
jest.mock('@/config/r2', () => ({ isR2PublicUrl: () => true }));

function failLoad(uri: string) {
  const load = loads.find((l) => l.uri === uri);
  if (!load) throw new Error(`${uri} was never loaded`);
  act(() => load.fail({ error: 'not found' }));
}

beforeEach(() => {
  loads.length = 0;
});

// Issue #59: a photo that fails to load must fall back to the initials, not an empty frame.
describe('Match Found PlayerAvatar load error', () => {
  it('shows the initials when the photo fails to load', () => {
    const photo = 'https://r2.example.invalid/a.png';
    render(<PlayerAvatar name="Zed Quinn" uri={photo} size={48} />);

    failLoad(photo);

    expect(screen.getByText('ZQ')).toBeTruthy();
    expect(screen.UNSAFE_queryByType(Image)).toBeNull();
  });

  it('keeps showing the new photo when the old photo fails after the change', () => {
    const photoA = 'https://r2.example.invalid/a.png';
    const photoB = 'https://r2.example.invalid/b.png';
    const { rerender } = render(<PlayerAvatar name="Zed Quinn" uri={photoA} size={48} />);
    rerender(<PlayerAvatar name="Zed Quinn" uri={photoB} size={48} />);

    failLoad(photoA);

    expect(screen.queryByText('ZQ')).toBeNull();
    expect(screen.UNSAFE_getByType(Image).props.source).toEqual({ uri: photoB });
  });
});
