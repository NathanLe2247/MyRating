# shared

Types, Zod schemas, and constants used by `frontend/`, `mobile/`, and
`backend/`. This is the single source of truth for cross-app data shapes:
`Court`, `Tournament`, `RatingEntry`, `NewsItem`, and related enums/constants.

## Conventions

- No app-specific logic here — only types, schemas, and constants that at
  least two of the three apps consume.
- Every shape here should have a Zod schema (`z.infer` the TS type from it,
  not the other way around) so runtime validation and static types can't
  drift apart.
- Changing a shape here is a breaking change for every consumer — update
  `backend/supabase/migrations/` in the same PR, and check `frontend/` and
  `mobile/` usages before merging.
