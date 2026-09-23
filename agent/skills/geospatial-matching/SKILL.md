---
name: geospatial-matching
description: PostGIS radius queries for mobile-only match queueing — how nearby players/courts are found and queued.
---

# geospatial-matching

Conventions for finding nearby players and courts and queueing matches, using
PostGIS on the Supabase backend.

Scope: mobile-only. Consumed by `mobile/` and `backend/functions/matchmaking/`.
Do not surface queueing in `frontend/`.

TODO: document the radius query pattern, queue table shape, and how it
composes with `courts-catalog`.
