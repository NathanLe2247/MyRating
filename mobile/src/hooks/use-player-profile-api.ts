import { FunctionsHttpError } from '@supabase/supabase-js';
import { useMemo } from 'react';

import { useSupabaseClient } from '@/config/supabase';
import type { PickedAvatar, PlayerProfileInput, RatingSource } from '@/types/profile';

const FUNCTION_NAME = 'player-profile';

/** `code` is the edge function's `error` field (e.g. `username_taken`), or `network`/`avatar_upload_failed`. */
export class PlayerProfileApiError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

type AvatarUploadUrl = { uploadUrl: string; key: string; publicUrl: string };

/** Client for the `player-profile` edge function (see backend/supabase/functions/player-profile). */
export function usePlayerProfileApi() {
  const supabase = useSupabaseClient();

  return useMemo(() => {
    const call = async <T>(route: string, body: object): Promise<T> => {
      const { data, error } = await supabase.functions.invoke<T>(`${FUNCTION_NAME}${route}`, { body });
      if (error) {
        const code =
          error instanceof FunctionsHttpError
            ? ((await error.context.json().catch(() => null)) as { error?: string } | null)?.error
            : undefined;
        throw new PlayerProfileApiError(code ?? 'network');
      }
      return data as T;
    };

    // Uploads straight to R2 with a presigned URL; returns the object key.
    const uploadAvatar = async ({ uri, contentType }: PickedAvatar) => {
      const { uploadUrl, key } = await call<AvatarUploadUrl>('/avatar-upload-url', { contentType });
      const file = await (await fetch(uri)).blob();
      const res = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file });
      if (!res.ok) throw new PlayerProfileApiError('avatar_upload_failed');
      return key;
    };

    return {
      isUsernameAvailable: async (username: string) =>
        (await call<{ available: boolean }>('/username', { username })).available,

      saveProfile: async (input: PlayerProfileInput, avatar: PickedAvatar | null) => {
        const avatarKey = avatar ? await uploadAvatar(avatar) : null;
        await call<{ id: string }>('', { ...input, avatarKey });
      },

      saveRatingSource: async (source: RatingSource) => {
        await call<{ id: string }>('/rating-source', { source });
      },
    };
  }, [supabase]);
}
