---
name: health-integrations
description: HealthKit and WHOOP OAuth integration conventions, mobile-only.
---

# health-integrations

Conventions for reading Apple HealthKit data on-device and integrating with
WHOOP via OAuth.

Scope: mobile-only. Consumed by `mobile/` and `backend/functions/whoop-oauth/`.
Raw health data and OAuth tokens must not be persisted in `shared/` or any
client-visible table — see `backend/CLAUDE.md`.

TODO: document the WHOOP OAuth token refresh flow and which HealthKit
metrics are read.
