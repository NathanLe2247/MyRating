import { useUser } from '@clerk/expo';
import { renderHook } from '@testing-library/react-native';

import { OnboardingCompletedKey, ProfileCompletedKey } from '@/constants/profile';
import { useOnboarding } from '@/hooks/use-onboarding';

jest.mock('@clerk/expo', () => ({
  useUser: jest.fn(),
}));

const mockUseUser = useUser as jest.Mock;

const CompletedAt = '2026-01-01T00:00:00Z';

type FakeUserOptions = {
  profileDone?: boolean;
  ratingDone?: boolean;
};

function fakeUser({ profileDone = false, ratingDone = false }: FakeUserOptions = {}) {
  return {
    publicMetadata: {
      ...(profileDone ? { [ProfileCompletedKey]: CompletedAt } : {}),
      ...(ratingDone ? { [OnboardingCompletedKey]: CompletedAt } : {}),
    },
  };
}

type ClerkState = {
  user: ReturnType<typeof fakeUser> | null;
  isLoaded?: boolean;
};

function mockClerk({ user, isLoaded = true }: ClerkState) {
  mockUseUser.mockReturnValue({ isLoaded, user: isLoaded ? user : undefined });
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

  it('has no way to skip onboarding', () => {
    mockClerk({ user: fakeUser() });

    const { result } = renderHook(() => useOnboarding());

    expect(result.current).not.toHaveProperty('skip');
  });
});
