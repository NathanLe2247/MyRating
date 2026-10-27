import { z } from 'zod';

// Row shape of public.courts (backend/supabase/migrations/*_courts.sql).
// Intentionally minimal until the courts catalog is designed — see
// agent/skills/courts-catalog. `location` is a PostGIS geography point,
// serialized as GeoJSON.
export const CourtSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  location: z.object({
    type: z.literal('Point'),
    // [longitude, latitude]
    coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
  }),
  is_active: z.boolean(),
  created_at: z.string().datetime({ offset: true }),
});

export type Court = z.infer<typeof CourtSchema>;
