---
name: mobile-auth-smoke
description: Launch the mobile app as an Expo web build and smoke test its Clerk auth flows end to end in headless Chromium — sign-in/sign-up/forgot-password navigation, email + password and phone (SMS code) sign-up and sign-in, password reset, and the Google OAuth button. Use when asked to run, smoke test, or verify the mobile app's login/sign-up flows, or after changing anything under mobile/app/(auth), mobile/src/components/auth, or the auth hooks.
---

# mobile-auth-smoke

Runs `mobile/` on web (`expo start --web`) and drives it with Playwright via
`auth-smoke.mjs` in this directory. Reports pass / FAIL / skip per step,
saves a screenshot per step, and exits non-zero on any FAIL.

**Look at the screenshots** for anything that fails — the on-screen error is
in the step's note, but a blank or half-rendered screen is only visible in
the PNG.

## 1. Pick the code to test

Test a clean checkout of the branch under test, not a working tree with
unrelated edits. A worktree is easiest; reuse the main checkout's
`node_modules` if `mobile/package.json` matches, otherwise `npm ci`:

```bash
REPO=/Users/quan/myRating
RUN=$(mktemp -d)/run                        # or the session scratchpad
git -C $REPO fetch -q origin
git -C $REPO worktree add -q --detach $RUN origin/main   # or the PR branch
diff -q <(git -C $REPO show origin/main:mobile/package.json) $REPO/mobile/package.json \
  && ln -s $REPO/mobile/node_modules $RUN/mobile/node_modules \
  || (cd $RUN/mobile && npm ci)
cp $REPO/mobile/.env.local $RUN/mobile/      # EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
```

## 2. Start the web build

Run in the background; it keeps serving until killed:

```bash
cd $RUN/mobile && CI=1 BROWSER=none npx expo start --web --port 8099 > $RUN/../expo.log 2>&1
```

Wait for it (no `timeout` on macOS — loop):

```bash
for i in $(seq 1 60); do curl -sf -o /dev/null http://localhost:8099 && echo up && break; sleep 2; done
```

First page load bundles the app (~15 s); the script waits up to 2 min.

## 3. Install the driver (once per machine)

Keep Playwright out of the repo:

```bash
DRIVER=$(mktemp -d)/driver && mkdir -p $DRIVER && cd $DRIVER
npm init -y >/dev/null && npm i -s playwright@1 && npx playwright install chromium
```

## 4. Run

The script imports `playwright`, so run a copy from the driver directory:

```bash
cp /Users/quan/myRating/.claude/skills/mobile-auth-smoke/auth-smoke.mjs $DRIVER/
mkdir -p $DRIVER/shots && cd $DRIVER && node auth-smoke.mjs $DRIVER/shots
```

Run it in the background for long runs and read the JSON when it finishes —
a foreground run can be cut off mid-way.

### Account flows need a Clerk testing token

Sign-up is behind Clerk bot protection (a Cloudflare "Verify you are human"
widget), which headless Chromium can't pass. Without a token the script runs
the 11 no-account checks and marks the 7 account flows `skip`.

To run everything, provide the **dev** instance secret key — the script
mints a [testing token](https://clerk.com/docs/testing/overview) and adds it
to every Frontend API request (as `@clerk/testing` does), and also sets
`captcha_enabled: false` in the intercepted `/v1/environment` response. The token
alone isn't enough: clerk-js still renders the Turnstile widget and waits on
it.

```bash
CLERK_SECRET_KEY=sk_test_... node auth-smoke.mjs $DRIVER/shots
```

Never commit the key or paste it into chat; read it from an untracked env
file. Alternative: temporarily disable *Bot sign-up protection* in the Clerk
dashboard (Configure → Attack protection) and re-enable it after.

Test credentials (dev instances only — nothing is actually sent):
- email: any `…+clerk_test@example.com`, code `424242`
- phone: `+1 555-555-0100` … `0199`, code `424242`. These are shared across
  runs, so phone sign-up retries numbers until one is free.

## 5. Stop

```bash
lsof -ti:8099 -sTCP:LISTEN | xargs kill
git -C /Users/quan/myRating worktree remove --force $RUN
```

## What it covers

No account needed: where a signed-out visit lands (sign-up on current
builds, sign-in on builds before onboarding; the note says which),
sign-in ↔ sign-up ↔ forgot-password links (including the
`dismissTo` back links), sign-up phone/email toggle and phone formatting,
log-in disabled until filled, unknown email/phone/reset errors, phone
identifier hiding the password field ("Text me a code"), Google button
opening `accounts.google.com`, and the `/sso-callback` page Google returns to
(showing "Finishing Google sign-in", not "Unmatched Route").

With a token: email sign-up → verify → onboarding step 1 → "Skip for now"
→ home (builds without onboarding go straight home; the note says which).
Every later sign-in also passes through onboarding, because a skip only lasts
for that session; the notes show "via onboarding step 1 (skipped)" each time; wrong password; email +
password sign-in; phone sign-up with no password (same onboarding handling); phone sign-in with a wrong
then correct code; forgot-password reset and sign-in with the new password.

Not covered (needs a device/simulator or real accounts): completing Google
OAuth, the native iOS/Android paths (`useSSO` browser warm-up, SF/Material
symbols), real SMS delivery, the "keep me logged in" checkbox (not wired).

## Gotchas

- **Hidden stack screens.** Expo Router on web keeps earlier screens mounted
  but hidden; a plain `getByPlaceholder(...).first()` matches the hidden one
  and times out. Every locator in the script filters `{ visible: true }` —
  keep that when adding steps.
- **Steps start fresh.** Each step reloads `/`, skips onboarding and signs
  out if needed, then goes to sign-in (via "Log in" when `/` lands on
  sign-up), so one failure doesn't cascade.
- **Onboarding is skipped, not completed.** "Continue" needs the
  `player-profile` edge function, which may not be deployed where
  `EXPO_PUBLIC_SUPABASE_URL` points; "Skip for now" only writes Clerk
  `unsafeMetadata`. Test the Continue path against a local stack
  (`supabase functions serve player-profile`) separately.
- **Home is the dashboard**, detected by its "Recent matches" heading
  (older builds: the template's "Sign out" row). Sign-out sits behind the
  dashboard's options menu (a browser `confirm` on web), so the script signs
  out with `window.Clerk.signOut()` instead of the UI.
- **A Supabase 401 in `consoleErrors`** is the dashboard's rating fetch:
  the Supabase project isn't accepting Clerk session tokens (Clerk
  third-party auth not enabled there). Home still renders, with the rating
  as "—" and "Couldn't load your rating". It's reported, not filtered, so it
  disappears once the integration is on.
- **Port 8099 may be taken** by another session's Expo server; `expo start`
  then exits in CI mode, and a curl check passes against the *other* server.
  Check `lsof -iTCP:8099 -sTCP:LISTEN` and use a free port with `BASE_URL`.
- **Selectors are UI strings** from `mobile/src/i18n/en.ts` (placeholders,
  button labels). If you change copy there, update `PH` / the regexes.
- **Expected console noise** is filtered: Clerk 422s for the "not found"
  checks, the Google popup's Cross-Origin-Opener-Policy warning.
- **Server exit 144** means the Expo process was killed; restart step 2.
  A run against a dead server fails every step with `page.goto` errors.
