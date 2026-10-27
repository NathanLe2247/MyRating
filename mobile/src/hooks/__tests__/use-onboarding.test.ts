import { useSession, useUser } from '@clerk/expo';
import { act, renderHook } from '@testing-library/react-native';

import { OnboardingCompletedKey, OnboardingSkippedKey, ProfileCompletedKey } from '@/constants/profile';
import { useOnboarding } from '@/hooks/use-onboarding';

jest.mock('@clerk/expo', () => ({
  useUser: jest.fn(),
  useSession: jest.fn(),
}));

const mockUseUser = useUser as jest.Mock;
const mockUseSession = useSession as jest.Mock;

const SessionId = 'sess_current';
const CompletedAt = '2026-01-01T00:00:00Z';

type FakeUserOptions = {
  profileDone?: boolean;
  ratingDone?: boolean;
  skippedSessionId?: string;
};

function fakeUser({ profileDone = false, ratingDone = false, skippedSessionId }: FakeUserOptions = {}) {
  return {
    publicMetadata: {
      ...(profileDone ? { [ProfileCompletedKey]: CompletedAt } : {}),
      ...(ratingDone ? { [OnboardingCompletedKey]: CompletedAt } : {}),
    },
    unsafeMetadata: skippedSessionId ? { [OnboardingSkippedKey]: skippedSessionId } : {},
    updateMetadata: jest.fn().mockResolvedValue(undefined),
  };
}

type ClerkState = {
  user: ReturnType<typeof fakeUser> | null;
  session?: { id: string } | null;
  isLoaded?: boolean;
};

function mockClerk({ user, session = user ? { id: SessionId } : null, isLoaded = true }: ClerkState) {
  mockUseUser.mockReturnValue({ isLoaded, user: isLoaded ? user : undefined });
  mockUseSession.mockReturnValue({ isLoaded, session: isLoaded ? session : undefined });
}

describe('useOnboarding', () => {
  afterEach(() => jest.clearAllMocks());

  it('does not send anyone to onboarding before Clerk has loaded', () => {
    mockClerk({ user: fakeUser(), isLoaded: false });

    const { result } = renderHook(() => useOnboarding());

    expect(result.current.isLoaded).toBe(false);
    expect(result.current.needsOnboarding).toBe(false);
    expect(result.current.nextStep).toBe('/onboarding/profile');
  });

  it('does not send a signed-out visitor to onboarding', () => {
    mockClerk({ user: null });

    const { result } = renderHook(() => useOnboarding());

    expect(result.current.isLoaded).toBe(true);
    expect(result.current.needsOnboarding).toBe(false);
    expect(result.current.nextStep).toBe('/onboarding/profile');
  });

  it('starts at the profile step when the profile is not done', () => {
    mockClerk({ user: fakeUser() });

    const { result } = renderHook(() => useOnboarding());

    expect(result.current.needsOnboarding).toBe(true);
    expect(result.current.profileCompleted).toBe(false);
    expect(result.current.nextStep).toBe('/onboarding/profile');
  });

  it('moves on to the rating step once the profile is done', () => {
    mockClerk({ user: fakeUser({ profileDone: true }) });

    const { result } = renderHook(() => useOnboarding());

    expect(result.current.needsOnboarding).toBe(true);
    expect(result.current.profileCompleted).toBe(true);
    expect(result.current.onboardingCompleted).toBe(false);
    expect(result.current.nextStep).toBe('/onboarding/rating');
  });

  it('stops sending the user back once both steps are done', () => {
    mockClerk({ user: fakeUser({ profileDone: true, ratingDone: true }) });

    const { result } = renderHook(() => useOnboarding());

    expect(result.current.needsOnboarding).toBe(false);
    expect(result.current.onboardingCompleted).toBe(true);
    expect(result.current.nextStep).toBe('/onboarding/rating');
  });

  it('does not send the user back after skipping in this session', () => {
    mockClerk({ user: fakeUser({ skippedSessionId: SessionId }) });

    const { result } = renderHook(() => useOnboarding());

    expect(result.current.needsOnboarding).toBe(false);
    expect(result.current.nextStep).toBe('/onboarding/profile');
  });

  it('sends the user back when they skipped in a previous session', () => {
    mockClerk({ user: fakeUser({ profileDone: true, skippedSessionId: 'sess_previous' }) });

    const { result } = renderHook(() => useOnboarding());

    expect(result.current.needsOnboarding).toBe(true);
    expect(result.current.nextStep).toBe('/onboarding/rating');
  });

  describe('skip()', () => {
    it('records the current session id as skipped', async () => {
      const user = fakeUser();
      mockClerk({ user });

      const { result } = renderHook(() => useOnboarding());
      await act(() => result.current.skip());

      expect(user.updateMetadata).toHaveBeenCalledTimes(1);
      expect(user.updateMetadata).toHaveBeenCalledWith({
        unsafeMetadata: { [OnboardingSkippedKey]: SessionId },
      });
    });

    it('does nothing without a session', async () => {
      const user = fakeUser();
      mockClerk({ user, session: null });

      const { result } = renderHook(() => useOnboarding());
      await act(() => result.current.skip());

      expect(user.updateMetadata).not.toHaveBeenCalled();
    });
  });
});
