# backend/django

A Django service running alongside Supabase edge functions.

**Ownership boundary is not yet decided.** Until it is, don't add business
logic here that duplicates something `functions/` already owns
(`ratings/`, `matchmaking/`, `dupr-import/`, `whoop-oauth/`). Confirm with
the user which side (edge functions vs. this service) owns a given piece of
logic before implementing it here.

## Structure (planned)

- `config/` — the Django project package (`settings.py`, `urls.py`, `asgi.py`/
  `wsgi.py`) — not yet generated (no `django-admin startproject` run).
- `apps/` — Django apps live here, one directory per app, instead of at the
  project root.
- No project has been initialized yet — only the directory layout exists.
  When it is, use `django-admin startproject config .` from this directory
  and move the generated `config/` package's contents in, plus a
  `requirements.txt` or `pyproject.toml`.

## Conventions (provisional)

- Connects to the same Supabase Postgres instance directly (via
  `DATABASE_URL` / psycopg), not through the Supabase client SDK.
- Row shapes still must match the Zod schemas in `shared/`; mirror them as
  Django models/serializers rather than inventing a parallel shape. Any
  shape change is still a `shared/` + migration change first, per
  `backend/CLAUDE.md` — Django's own migrations should follow, not replace,
  the ones in `supabase/migrations/`.
- If this service exposes authenticated endpoints, it verifies the
  Clerk-issued JWT the same way Supabase RLS does (Clerk's JWKS) — see
  `.env.example` for what's needed.
