import { FunctionsHttpError } from '@supabase/supabase-js';

/**
 * The `error` field of an edge function's non-2xx JSON body (our functions
 * answer `{ error: <code> }`), or undefined when the call never got an HTTP
 * answer (network, relay error) or the body isn't one of those.
 */
export async function edgeFunctionErrorCode(error: unknown): Promise<string | undefined> {
  if (!(error instanceof FunctionsHttpError)) return undefined;
  const body = (await error.context.json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === 'string' ? body.error : undefined;
}
