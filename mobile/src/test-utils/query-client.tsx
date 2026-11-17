// Test-only React Query setup, for rendering components that run queries.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

/**
 * A fresh client per test. gcTime: Infinity stops React Query from scheduling
 * its 5-minute garbage-collection timer for unobserved queries; that timer
 * kept the Jest worker alive (#98).
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
}

/** `render` inside a fresh `QueryClientProvider` (kept across `rerender`). */
export function renderWithQueryClient(ui: ReactElement) {
  const client = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(ui, { wrapper });
}
