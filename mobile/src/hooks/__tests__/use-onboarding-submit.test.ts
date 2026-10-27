import { useUser } from '@clerk/expo';
import { act, renderHook } from '@testing-library/react-native';

import { useOnboardingSubmit } from '@/hooks/use-onboarding-submit';
import { PlayerProfileApiError } from '@/hooks/use-player-profile-api';

jest.mock('@clerk/expo', () => ({
  useUser: jest.fn(),
}));

const mockUseUser = useUser as jest.Mock;

describe('useOnboardingSubmit', () => {
  const reload = jest.fn();

  beforeEach(() => {
    reload.mockResolvedValue(undefined);
    mockUseUser.mockReturnValue({ user: { reload } });
  });

  afterEach(() => jest.clearAllMocks());

  it('runs the action, then reloads the user, and resolves true', async () => {
    const action = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useOnboardingSubmit(action));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.save('alice', 3.5);
    });

    expect(ok).toBe(true);
    expect(action).toHaveBeenCalledWith('alice', 3.5);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(action.mock.invocationCallOrder[0]).toBeLessThan(reload.mock.invocationCallOrder[0]);
    expect(result.current.errorCode).toBeNull();
    expect(result.current.saving).toBe(false);
  });

  it('reports saving while the action is in flight', async () => {
    let finish: () => void = () => {};
    const action = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = renderHook(() => useOnboardingSubmit(action));

    let pending: Promise<boolean> | undefined;
    act(() => {
      pending = result.current.save();
    });
    expect(result.current.saving).toBe(true);

    await act(async () => {
      finish();
      await pending;
    });
    expect(result.current.saving).toBe(false);
  });

  it('surfaces the edge function error code and resolves false', async () => {
    const action = jest.fn().mockRejectedValue(new PlayerProfileApiError('username_taken'));
    const { result } = renderHook(() => useOnboardingSubmit(action));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.save();
    });

    expect(ok).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    expect(result.current.errorCode).toBe('username_taken');
    expect(result.current.saving).toBe(false);
  });

  it('reports any other failure as a network error', async () => {
    const action = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    const { result } = renderHook(() => useOnboardingSubmit(action));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.save();
    });

    expect(ok).toBe(false);
    expect(result.current.errorCode).toBe('network');
  });

  it('clears the previous error on the next attempt', async () => {
    const action = jest
      .fn()
      .mockRejectedValueOnce(new PlayerProfileApiError('invalid_rating'))
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useOnboardingSubmit(action));

    await act(async () => {
      await result.current.save();
    });
    expect(result.current.errorCode).toBe('invalid_rating');

    await act(async () => {
      await result.current.save();
    });
    expect(result.current.errorCode).toBeNull();
  });
});
