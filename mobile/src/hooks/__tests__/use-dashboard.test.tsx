import { useAuth } from '@clerk/expo';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useSupabaseClient } from '@/config/supabase';
import { useDashboard } from '@/hooks/use-dashboard';

jest.mock('@clerk/expo', () => ({
  useAuth: jest.fn(),
}));
jest.mock('@/config/supabase', () => ({
  useSupabaseClient: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockUseSupabaseClient = useSupabaseClient as jest.Mock;

// Stands in for `supabase.from('users').select(...).eq(...).maybeSingle()`.
function mockRatingResponse(response: { data: unknown; error: unknown }) {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: () => Promise.resolve(response),
  };
  mockUseSupabaseClient.mockReturnValue({ from: () => query });
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

async function renderDashboard() {
  const hook = renderHook(() => useDashboard('doubles'), { wrapper });
  await waitFor(() => expect(hook.result.current.data).toBeDefined());
  return hook.result;
}

describe('useDashboard', () => {
  beforeEach(() => mockUseAuth.mockReturnValue({ userId: 'user_1' }));
  afterEach(() => jest.clearAllMocks());

  it('returns the player rating', async () => {
    mockRatingResponse({ data: { player_ratings: { rating: 4.18 } }, error: null });

    const result = await renderDashboard();

    expect(result.current.data?.rating).toBe(4.18);
    expect(result.current.error).toBeNull();
  });

  it('returns null (calibrating) when the player has no rating yet', async () => {
    mockRatingResponse({ data: { player_ratings: null }, error: null });

    const result = await renderDashboard();

    expect(result.current.data?.rating).toBeNull();
  });

  it('accepts the embed as a one-element array', async () => {
    mockRatingResponse({ data: { player_ratings: [{ rating: 1512.5 }] }, error: null });

    const result = await renderDashboard();

    expect(result.current.data?.rating).toBe(1512.5);
  });

  it('rejects a malformed row as a load error, not calibrating', async () => {
    mockRatingResponse({ data: { player_ratings: { rating: 'not a number' } }, error: null });

    const result = await renderDashboard();

    expect(result.current.error).toBeTruthy();
    expect(result.current.data?.rating).toBeUndefined();
  });

  it('leaves the rating unknown, not calibrating, when the fetch fails', async () => {
    mockRatingResponse({ data: null, error: new Error('network down') });

    const result = await renderDashboard();

    expect(result.current.error).toBeTruthy();
    expect(result.current.data?.rating).toBeUndefined();
  });
});
