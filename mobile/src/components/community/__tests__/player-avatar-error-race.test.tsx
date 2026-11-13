import { act, render, screen } from '@testing-library/react-native';
import { Image } from 'expo-image';

import { PlayerAvatar } from '@/components/community/player-avatar';

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

// Issue #55: a late load failure of the previous photo must not mark the new photo as failed.
describe('PlayerAvatar photo change', () => {
  it('keeps showing the new photo when the old photo fails after the change', () => {
    const photoA = 'https://example.invalid/a.png';
    const photoB = 'https://example.invalid/b.png';
    const { rerender } = render(<PlayerAvatar name="Zed" photoUrl={photoA} size={48} />);
    rerender(<PlayerAvatar name="Zed" photoUrl={photoB} size={48} />);

    // A's load fails only after the avatar has moved on to B.
    const loadA = loads.find((load) => load.uri === photoA);
    if (!loadA) throw new Error('photo A was never loaded');
    act(() => loadA.fail({ error: 'not found' }));

    expect(screen.queryByText('Z')).toBeNull();
    expect(screen.UNSAFE_getByType(Image).props.source).toEqual({ uri: photoB });
  });
});
