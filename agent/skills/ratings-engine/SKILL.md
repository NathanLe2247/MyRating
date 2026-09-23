---
name: ratings-engine
description: Glicko-2 rating conventions for myRating — rating/RD/volatility updates, match result encoding, and where rating math is allowed to live.
---

# ratings-engine

Conventions for computing and updating player skill ratings with Glicko-2.

Scope: the math and update rules only — shared by `backend/functions/ratings/`
(the only writer) and any read-side display logic in `frontend/` or `mobile/`
that needs to explain a rating (e.g. "provisional", "RD too high to rank").

TODO: document the rating period cadence, default rating/RD/volatility for
new players, and the `RatingEntry` fields this skill is responsible for.
