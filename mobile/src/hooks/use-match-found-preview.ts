import { useRouter } from 'expo-router';

import { DevPreviews, SampleMatchFound } from '@/constants/dev-previews';
import { MatchFoundRoute } from '@/constants/match';
import { serializeMatchFound } from '@/utils/match-found-param';

/**
 * Dev only (see `DevPreviews.matchFound`): a handler that opens Match Found
 * with sample data, or undefined when the preview flag is off — always in
 * production builds.
 */
export function useMatchFoundPreview(): (() => void) | undefined {
  const router = useRouter();
  if (!DevPreviews.matchFound) return undefined;
  return () =>
    router.push({
      pathname: MatchFoundRoute,
      params: { match: serializeMatchFound(SampleMatchFound) },
    });
}
