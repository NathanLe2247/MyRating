import { fireEvent, render, renderHook, screen } from '@testing-library/react-native';

import { QueueCard } from '@/components/home/queue-card';
import { en } from '@/i18n/en';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const FLAG = 'EXPO_PUBLIC_DEV_MATCH_FOUND_PREVIEW';

// DevPreviews reads the flag at import, so each case loads a fresh module copy.
function loadHook(flag: string | undefined) {
  if (flag === undefined) delete process.env[FLAG];
  else process.env[FLAG] = flag;
  let hook: typeof import('@/hooks/use-match-found-preview').useMatchFoundPreview;
  jest.isolateModules(() => {
    hook = require('@/hooks/use-match-found-preview').useMatchFoundPreview;
  });
  return hook!;
}

describe('useMatchFoundPreview + Home queue card', () => {
  afterEach(() => {
    delete process.env[FLAG];
    mockPush.mockClear();
  });

  it('does nothing when the dev preview flag is off', () => {
    const useMatchFoundPreview = loadHook(undefined);
    const { result } = renderHook(() => useMatchFoundPreview());
    expect(result.current).toBeUndefined();

    render(<QueueCard calibrating={false} onPress={result.current} />);
    fireEvent.press(screen.getByRole('button', { name: new RegExp(en.home.queue.title, 'i') }));

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('opens Match Found with the sample match when the flag is on', () => {
    const useMatchFoundPreview = loadHook('1');
    const { result } = renderHook(() => useMatchFoundPreview());

    render(<QueueCard calibrating={false} onPress={result.current} />);
    fireEvent.press(screen.getByRole('button', { name: new RegExp(en.home.queue.title, 'i') }));

    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/match/found', params: { match: expect.any(String) } }),
    );
  });
});
