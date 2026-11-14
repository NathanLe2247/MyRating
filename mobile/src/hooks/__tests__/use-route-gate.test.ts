import { useAuth, useUser } from '@clerk/expo';
import { renderHook } from '@testing-library/react-native';
import { usePathname } from 'expo-router';

import { OnboardingCompletedKey, ProfileCompletedKey } from '@/constants/profile';
import { signedOutRedirect } from '@/constants/routes';
import { usePublicGate, useSignedInGate } from '@/hooks/use-route-gate';

jest.mock('@clerk/expo', () => ({
  useAuth: jest.fn(),
  useUser: jest.fn(),
}));
jest.mock('expo-router', () => ({
  usePathname: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockUseUser = useUser as jest.Mock;
const mockUsePathname = usePathname as jest.Mock;

function signedOut() {
  mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: false });
  mockUseUser.mockReturnValue({ isLoaded: true, user: null });
}
function signedIn(metadata: Record<string, unknown>) {
  mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: true });
  mockUseUser.mockReturnValue({ isLoaded: true, user: { publicMetadata: metadata } });
}
const onboarded = { [ProfileCompletedKey]: 'x', [OnboardingCompletedKey]: 'x' };

describe('signedOutRedirect', () => {
  it('sends the app root to the public courts screen and gated routes to sign-up', () => {
    expect(signedOutRedirect('/')).toBe('/courts');
    for (const path of ['/play', '/health', '/community', '/match/found', '/onboarding/profile']) {
      expect(signedOutRedirect(path)).toBe('/sign-up');
    }
  });
});

describe('useSignedInGate', () => {
  afterEach(() => jest.clearAllMocks());

  it('waits while Clerk is loading', () => {
    mockUseAuth.mockReturnValue({ isLoaded: false, isSignedIn: undefined });
    mockUseUser.mockReturnValue({ isLoaded: false, user: undefined });
    mockUsePathname.mockReturnValue('/');

    expect(renderHook(() => useSignedInGate()).result.current).toEqual({ status: 'pending' });
  });

  it('lands a signed-out visit to / on the courts screen', () => {
    signedOut();
    mockUsePathname.mockReturnValue('/');

    expect(renderHook(() => useSignedInGate()).result.current).toEqual({
      status: 'redirect',
      href: '/courts',
    });
  });

  it.each(['/play', '/health', '/community', '/match/found'])(
    'never renders %s signed out: it redirects to sign-up',
    (path) => {
      signedOut();
      mockUsePathname.mockReturnValue(path);

      expect(renderHook(() => useSignedInGate()).result.current).toEqual({
        status: 'redirect',
        href: '/sign-up',
      });
    },
  );

  it('still sends signed-in players to onboarding until they finish it', () => {
    signedIn({});
    mockUsePathname.mockReturnValue('/play');

    expect(renderHook(() => useSignedInGate()).result.current).toEqual({
      status: 'redirect',
      href: '/onboarding/profile',
    });
  });

  it('lets onboarded players in', () => {
    signedIn(onboarded);
    mockUsePathname.mockReturnValue('/');

    expect(renderHook(() => useSignedInGate()).result.current).toEqual({ status: 'allow' });
  });
});

describe('usePublicGate', () => {
  afterEach(() => jest.clearAllMocks());

  it('lets signed-out visitors see the courts screen', () => {
    signedOut();
    expect(renderHook(() => usePublicGate()).result.current).toEqual({ status: 'allow' });
  });

  it('sends signed-in players to Play, which has the same list', () => {
    signedIn(onboarded);
    expect(renderHook(() => usePublicGate()).result.current).toEqual({
      status: 'redirect',
      href: '/play',
    });
  });

  it('waits while Clerk is loading', () => {
    mockUseAuth.mockReturnValue({ isLoaded: false, isSignedIn: undefined });
    expect(renderHook(() => usePublicGate()).result.current).toEqual({ status: 'pending' });
  });
});
