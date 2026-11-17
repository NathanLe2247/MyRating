// Auth smoke test for the mobile app's Expo web build.
//
//   node auth-smoke.mjs <screenshot-dir>
//
// Env:
//   BASE_URL          default http://localhost:8099
//   CLERK_SECRET_KEY  sk_test_… (dev instance) — mints a Clerk testing token so
//                     sign-up gets past bot protection, and marks the test
//                     accounts onboarded through the Backend API. Without it,
//                     account flows are reported as skipped.
//   CLERK_TESTING_TOKEN  use an already-minted token instead (account flows
//                     still need CLERK_SECRET_KEY to get past onboarding).
//
// Uses Clerk dev-instance test credentials: `+clerk_test` emails and
// +1 555-555-01xx phones, which accept code 424242 and send nothing.
import { chromium } from 'playwright';
import { isPhoneTaken } from './phone-taken.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:8099';
const OUT = process.argv[2] ?? '.';
const CODE = '424242';
const T = 30000;

// Placeholders double as stable selectors (they come from src/i18n/en.ts).
const PH = {
  identifier: 'e.g. elena@court.io or (512) 555-0134',
  email: 'e.g. elena@court.io',
  password: '••••••••••••',
  phone: '(555) 000-0000',
  code: '123456',
};

// Clerk publicMetadata keys that mark onboarding done (ProfileCompletedKey /
// OnboardingCompletedKey in mobile/src/constants/profile.ts). The app's
// useOnboarding() only checks the second; both are set, as the player-profile
// edge function would after the two steps.
const ONBOARDING_KEYS = ['profileCompletedAt', 'onboardingCompletedAt'];

const sk = process.env.CLERK_SECRET_KEY;
// Dev instances only: the script creates accounts and writes their metadata.
if (sk && !sk.startsWith('sk_test_')) {
  console.error('CLERK_SECRET_KEY is not a dev instance key (sk_test_…); refusing to run.');
  process.exit(2);
}
async function clerkApi(method, path, body) {
  if (!sk) throw new Error('CLERK_SECRET_KEY is needed for this step');
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${sk}`, 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Clerk ${method} ${path} failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function mintTestingToken() {
  if (process.env.CLERK_TESTING_TOKEN) return process.env.CLERK_TESTING_TOKEN;
  if (!sk) return null;
  return (await clerkApi('POST', '/testing_tokens')).token;
}

const testingToken = await mintTestingToken();
const browser = await chromium.launch();
// A fixed location (Columbia Local Park, Burtonsville, MD, a public anchor)
// so the signed-out courts screen loads its nearby list instead of waiting
// on a permission prompt.
const ctx = await browser.newContext({
  viewport: { width: 420, height: 900 },
  geolocation: { latitude: 39.1022, longitude: -76.9441 },
  permissions: ['geolocation'],
});
const page = await ctx.newPage();

// Same mechanism as @clerk/testing: tag every Frontend API call with the
// testing token so the dev instance skips bot protection. Also switch the
// captcha off in the environment payload — the token alone doesn't stop
// clerk-js from rendering the Turnstile widget and waiting on it.
if (testingToken) {
  await page.route(/\.clerk\.accounts\.dev\/v1\//, async (route) => {
    const url = new URL(route.request().url());
    url.searchParams.set('__clerk_testing_token', testingToken);
    if (!url.pathname.endsWith('/v1/environment')) return route.continue({ url: url.toString() });
    const response = await route.fetch({ url: url.toString() });
    const json = await response.json();
    if (json.user_settings?.sign_up) json.user_settings.sign_up.captcha_enabled = false;
    await route.fulfill({ response, json });
  });
}

const errors = [];
// Console lines can carry request URLs, which include the testing token.
const redact = (t) => t.replace(/(__clerk_testing_token=)[^&\s"')]+/g, '$1REDACTED');
page.on('pageerror', (e) => errors.push(redact(`PAGEERROR ${e.message}`)));
page.on('console', (m) => m.type() === 'error' && errors.push(redact(m.text())));

// Expo Router on web keeps earlier stack screens mounted but hidden, so
// every locator must be filtered to visible elements.
const vis = (l) => l.filter({ visible: true }).first();
const text = (re) => vis(page.getByText(re));
const btn = (re) => vis(page.getByRole('button', { name: re }));
const link = (re) => vis(page.getByRole('link', { name: re }));
const ph = (key) => vis(page.getByPlaceholder(PH[key]));
const alert = () => vis(page.getByRole('alert'));
const alertText = async () => ((await alert().count()) ? await alert().innerText() : null);
const orFail = (what) => async () => {
  throw new Error(`${what}; on-screen error: ${await alertText()}`);
};

// Which screen `/` lands on. Signed out, the app starts on the public
// "Courts near you" screen (#70; older builds started on sign-up, and before
// that sign-in); signed in, it's home or onboarding step 1.
const SCREENS = {
  courts: () => text(/find a court\. get rated\./i),
  signIn: () => text(/welcome back/i),
  signUp: () => text(/join myrating/i),
  // Dashboard home, by its header's "Account options" button: it renders
  // before the rating loads, while "Recent matches" only shows once there are
  // matches. Older builds: the template home with a "Sign out" row.
  home: () => vis(page.getByRole('button', { name: /account options/i }).or(page.getByText(/sign out/i))),
  onboarding: () => text(/create your profile/i),
};
async function landing(timeout, only = Object.keys(SCREENS)) {
  return Promise.any(
    only.map((name) =>
      SCREENS[name]()
        .waitFor({ timeout })
        .then(() => name)
    )
  ).catch(() => null);
}

// Every step starts signed out on sign-in, whatever `/` lands on.
async function toSignIn() {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
  let screen = await landing(120000);
  if (screen === 'onboarding') screen = await markOnboarded();
  if (screen === 'home') screen = await signOut();
  await toSignInFrom(screen);
}
// From a signed-out landing screen to sign-in: the courts screen's "Log in"
// link, or sign-up's.
async function toSignInFrom(screen) {
  if (screen === 'courts' || screen === 'signUp') await link(/^log in/i).click();
  await SCREENS.signIn().waitFor({ timeout: T });
}
// Signs out through clerk-js (exposed as window.Clerk on web). The dashboard
// only offers sign-out behind its options menu (a browser confirm on web), and
// the floating tab bar can cover controls, so the UI path isn't reliable here.
async function signOut() {
  await page.evaluate(() => window.Clerk.signOut());
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
  return landing(T);
}
// Onboarding is required (no "Skip for now"), and finishing it through the UI
// needs the player-profile edge function, which may not be deployed where
// EXPO_PUBLIC_SUPABASE_URL points. Instead, set the publicMetadata the edge
// function would set, through the Clerk Backend API, then reload the user in
// clerk-js so the app sees it. `done = false` clears it again.
//
// Guarded so it can only touch this script's own accounts on a dev instance:
// the page must use a pk_test_ key, and the user (as the Backend API reports
// it) must only have Clerk test identifiers — `+clerk_test@example.com`
// emails and +1 555-555-01xx phones.
const TEST_EMAIL = /\+clerk_test@example\.com$/i;
const TEST_PHONE = /^\+155555501\d\d$/;
async function assertDevInstance() {
  const pk = await page.evaluate(() => window.Clerk?.publishableKey ?? '');
  if (!pk.startsWith('pk_test_')) throw new Error('app is not using a dev Clerk instance (pk_test_…); refusing');
}
async function assertTestAccount(userId) {
  const user = await clerkApi('GET', `/users/${userId}`);
  const ids = [
    ...user.email_addresses.map((e) => [e.email_address, TEST_EMAIL]),
    ...user.phone_numbers.map((p) => [p.phone_number, TEST_PHONE]),
  ];
  if (!ids.length || ids.some(([id, re]) => !re.test(id))) {
    throw new Error(`user ${userId} is not a Clerk test account; refusing to change its metadata`);
  }
}
async function setOnboarded(done) {
  await assertDevInstance();
  const userId = await page.evaluate(() => window.Clerk.user?.id);
  if (!userId) throw new Error('no signed-in Clerk user');
  await assertTestAccount(userId);
  const value = done ? new Date().toISOString() : null; // null deletes the key
  await clerkApi('PATCH', `/users/${userId}/metadata`, {
    public_metadata: Object.fromEntries(ONBOARDING_KEYS.map((k) => [k, value])),
  });
  await page.evaluate(() => window.Clerk.user.reload());
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
}
async function markOnboarded() {
  await setOnboarded(true);
  await SCREENS.home().waitFor({ timeout: T }).catch(orFail('marked onboarded but not on home'));
  return 'home';
}
// A new account lands on onboarding step 1 after sign-up; once marked
// onboarded, later sign-ins go straight home (as do builds without
// onboarding). Gets past onboarding and returns which path was taken.
async function afterAuth(what) {
  // Only signed-in screens: the auth form stays visible while it submits.
  const screen = await landing(T, ['onboarding', 'home']);
  if (screen === 'onboarding') {
    await markOnboarded();
    return 'via onboarding step 1 (marked onboarded via Clerk API)';
  }
  if (screen !== 'home') await orFail(`${what}: not on onboarding or home`)();
  return 'straight to home';
}
// Signed-in tabs (PR #13 onward), by route (AppTabHrefs in
// src/constants/tabs.ts). Detection doesn't depend on what a tab's screen
// shows, since each placeholder is replaced as its feature lands: click the
// tab-bar link for the route, wait for the URL and for the page to settle,
// then screenshot (<step>-home.png, <step>-tab-play.png, and so on).
const TAB_HREFS = { play: '/play', health: '/health', community: '/community' };
const SETTLE_MS = 1500;
const tabLink = (href) => vis(page.locator(`a[href="${href}"]`));
async function openTab(href) {
  await tabLink(href).click();
  await page.waitForURL((u) => u.pathname === href, { timeout: T });
  // Let the screen's first fetches and animations finish; a screen that keeps
  // polling never goes idle, so this is best-effort.
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(SETTLE_MS);
}
async function visitTabs() {
  // The dashboard shows a spinner until the rating query settles (it retries
  // a failing Supabase fetch for several seconds); wait for the queue card or
  // the load error so the screenshot shows the dashboard. Not a failure if it
  // never comes: the note says so.
  const loaded = await text(/queue for match|placement match|couldn.t load your rating/i)
    .waitFor({ timeout: T })
    .then(() => true)
    .catch(() => false);
  await shot('home');
  const homeNote = loaded ? '' : ' (dashboard still loading)';
  if (!(await tabLink(TAB_HREFS.play).count())) return `no Play/Health/Community tabs (pre-#13 build)${homeNote}`;
  for (const [name, href] of Object.entries(TAB_HREFS)) {
    await openTab(href).catch(orFail(`${name} tab didn't open`));
    await shot(`tab-${name}`);
  }
  await openTab('/').catch(orFail("home tab didn't reopen"));
  await SCREENS.home().waitFor({ timeout: T }).catch(orFail("home tab didn't reopen"));
  return `home${homeNote} + play/health/community tabs open`;
}
async function enterCode(code = CODE) {
  await ph('code').fill(code);
  await btn(/^verify/i).click();
}

const results = [];
let n = 0;
const slug = (s) => s.replace(/\W+/g, '-').replace(/-$/, '').toLowerCase();
// Extra screenshot inside the current step, numbered like the step's own.
const shot = (label) =>
  page.screenshot({ path: `${OUT}/${String(n + 1).padStart(2, '0')}-${slug(label)}.png` });
async function step(name, fn, { needsAccount = false } = {}) {
  if (needsAccount && !(testingToken && sk)) {
    results.push({ name, status: 'skip', note: 'no CLERK_SECRET_KEY' });
    return;
  }
  try {
    await toSignIn();
    if (needsAccount) await assertDevInstance();
    results.push({ name, status: 'pass', note: (await fn()) ?? '' });
  } catch (e) {
    results.push({ name, status: 'FAIL', note: e.message.split('\n')[0] });
  }
  const file = `${String(++n).padStart(2, '0')}-${slug(name)}.png`;
  await page.screenshot({ path: `${OUT}/${file}` }).catch(() => {});
}

// ---------------------------------------------------------------- no account

await step('start: signed-out landing screen', async () => {
  // step() has already signed out and moved to sign-in; reload to see where
  // a fresh signed-out visit lands.
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const screen = await landing(120000);
  if (screen === 'signUp' || screen === 'signIn') {
    return `lands on ${screen === 'signUp' ? 'sign-up' : 'sign-in'} (pre-#70 build)`;
  }
  if (screen !== 'courts') throw new Error(`landed on ${screen}`);
  // The nearby list (or its empty state) loads at the mocked location.
  const list = await text(/\d+ near you|no courts nearby/i)
    .waitFor({ timeout: T })
    .then(async () => ((await text(/\d+ near you/i).count()) ? await text(/\d+ near you/i).innerText() : 'no courts nearby'))
    .catch(orFail('courts list did not load at the mocked location'));
  await btn(/^sign up$/i).click();
  await SCREENS.signUp().waitFor({ timeout: T }).catch(orFail('"Sign up" did not open sign-up'));
  await link(/browse courts near you/i).click();
  await SCREENS.courts().waitFor({ timeout: T }).catch(orFail('"Browse courts near you" did not return'));
  await link(/^log in/i).click();
  await SCREENS.signIn().waitFor({ timeout: T }).catch(orFail('"Log in" did not open sign-in'));
  return `lands on courts (${list.toLowerCase()}); sign up / log in reachable`;
});

// Every route but the courts screen and (auth) needs an account (#70).
for (const path of ['/play', '/match/found']) {
  await step(`gate: signed-out ${path} redirects to sign-up`, async () => {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await SCREENS.signUp().waitFor({ timeout: T }).catch(orFail(`${path} did not redirect to sign-up`));
    await page.waitForURL((u) => u.pathname === '/sign-up', { timeout: T });
  });
}

await step('nav: sign-in <-> sign-up', async () => {
  await link(/sign up/i).click();
  await text(/join myrating/i).waitFor({ timeout: T });
  await link(/^log in/i).click();
  await text(/welcome back/i).waitFor({ timeout: T });
});

await step('nav: sign-in <-> forgot password', async () => {
  await link(/^forgot\?/i).click();
  await text(/reset password/i).waitFor({ timeout: T });
  await link(/back to log in/i).click();
  await text(/welcome back/i).waitFor({ timeout: T });
  await link(/forgot password\? reset/i).click();
  await text(/reset password/i).waitFor({ timeout: T });
});

await step('sign-up: phone <-> email toggle, phone formatting', async () => {
  await link(/sign up/i).click();
  await ph('phone').waitFor({ timeout: T });
  await link(/sign up with email/i).click();
  await ph('email').waitFor({ timeout: T });
  await link(/sign up with your phone/i).click();
  await ph('phone').fill('5125550134');
  const shown = await ph('phone').inputValue();
  if (shown !== '(512) 555-0134') throw new Error(`formatted as "${shown}"`);
});

await step('sign-in: log-in disabled until filled', async () => {
  const before = await btn(/^log in/i).getAttribute('aria-disabled');
  await ph('identifier').fill('nobody+clerk_test@example.com');
  await ph('password').fill('x');
  const after = await btn(/^log in/i).getAttribute('aria-disabled');
  if (before !== 'true' || after === 'true') throw new Error(`aria-disabled before=${before} after=${after}`);
});

await step('sign-in: unknown email shows error', async () => {
  await ph('identifier').fill(`nobody${Date.now()}+clerk_test@example.com`);
  await ph('password').fill('Wrong-pass-123!');
  await btn(/^log in/i).click();
  await alert().waitFor({ timeout: T });
  return alertText();
});

await step('sign-in: phone identifier swaps password for SMS', async () => {
  await ph('identifier').fill('(555) 555-0199');
  if (await ph('password').isVisible().catch(() => false)) throw new Error('password still visible');
  await btn(/text me a code/i).waitFor({ timeout: T });
  await ph('identifier').fill('elena@court.io');
  await ph('password').waitFor({ timeout: T });
});

await step('sign-in: unknown phone shows error', async () => {
  await ph('identifier').fill('+1 555-555-0177');
  await btn(/text me a code/i).click();
  return Promise.race([
    alert().waitFor({ timeout: T }).then(alertText),
    text(/check your texts/i).waitFor({ timeout: T }).then(() => 'number exists — reached code step'),
  ]);
});

await step('forgot password: unknown email shows error', async () => {
  await link(/^forgot\?/i).click();
  await ph('email').fill(`nobody${Date.now()}+clerk_test@example.com`);
  await btn(/send code/i).click();
  await alert().waitFor({ timeout: T });
  return alertText();
});

await step('google: button opens OAuth', async () => {
  const popup = page.waitForEvent('popup', { timeout: 20000 }).catch(() => null);
  const nav = page
    .waitForURL((u) => !u.href.startsWith(BASE), { timeout: 20000 })
    .then(() => page.url())
    .catch(() => null);
  await btn(/continue with google/i).click();
  const [pop, url] = await Promise.all([popup, nav]);
  if (pop) await pop.waitForLoadState().catch(() => {});
  const target = pop?.url() ?? url;
  if (!target) throw new Error(`no OAuth navigation; on-screen error: ${await alertText()}`);
  await pop?.close();
  return `${pop ? 'popup' : 'redirect'} -> ${new URL(target).host}`;
});

// Google OAuth returns to myrating://sso-callback (useSSO's default); without
// a route there the app shows "Unmatched Route" instead of continuing.
await step('google: /sso-callback route exists', async () => {
  await page.goto(`${BASE}/sso-callback`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await text(/finishing google sign-in/i).waitFor({ timeout: T });
  await link(/back to sign up/i).click();
  await SCREENS.signUp().waitFor({ timeout: T });
});

// ----------------------------------------------------- account flows (token)

const rand = String(Date.now()).slice(-7);
const email = `smoke${rand}+clerk_test@example.com`;
const password = `Smoke-${rand}-Pass!`;
const newPassword = `Reset-${rand}-Pass!`;
let phone = null;

await step(
  'email sign-up',
  async () => {
    await link(/sign up/i).click();
    await link(/sign up with email/i).click();
    await ph('email').fill(email);
    await ph('password').fill(password);
    await btn(/create account/i).click();
    await text(/check your email/i).waitFor({ timeout: T }).catch(orFail('no verify step'));
    await enterCode();
    return `${email}, ${await afterAuth('after email verify')}`;
  },
  { needsAccount: true }
);

await step(
  'email sign-in: wrong password shows error',
  async () => {
    await ph('identifier').fill(email);
    await ph('password').fill('Definitely-wrong-1!');
    await btn(/^log in/i).click();
    await alert().waitFor({ timeout: T });
    return alertText();
  },
  { needsAccount: true }
);

await step(
  'email sign-in with password',
  async () => {
    await ph('identifier').fill(email);
    await ph('password').fill(password);
    await btn(/^log in/i).click();
    const path = await afterAuth('after password sign-in');
    return `${path}; ${await visitTabs()}`;
  },
  { needsAccount: true }
);

// Home's queue card against the hosted `matchmaking` function (#79), then
// the score report against `match-results` (#80): searching → Match Found
// against the Demo Tester (DEMO_BOT_ENABLED) → Accept → "You're on!" →
// report 11–7, 11–9 with the steppers → the Demo Tester confirms (polled,
// ~3 s) → "Result confirmed" with the rating change → Done, so the account
// is idle again.
// The account's public.users row comes from the clerk-webhook; without one
// the function answers profile_required, and the step passes on that copy
// (from en.matchmaking.errors), since it still proves the Clerk token reached
// the function and the error is handled.
const QUEUE = {
  findMatch: /^find a match$/i,
  profileRequired: /finish setting up your profile to queue/i,
  searching: /^searching…$/i,
  // The Match Found screen's own Accept button: Home's queue card also says
  // "Match found!", so waiting on that title could pass before the screen opens.
  accept: /^accept match$/i,
  on: /^you.re on!$/i,
  // Report result (en.reportResult): stepper and tab button labels.
  you: 'you',
  bot: 'Demo Tester',
  addGame: /^add a game$/i,
  submit: /^submit score$/i,
  confirmed: /^result confirmed$/i,
  // "1500.00 → 1523.45 (+23.45)", from rating_history via the function.
  ratingChange: /^\d+\.\d\d → \d+\.\d\d \([+-]?\d+\.\d\d\)$/,
  done: /^done$/i,
};
const BOT_WAIT_MS = 20000;
const pointUp = (who) => btn(new RegExp(`^add a point for ${who}$`, 'i'));
async function enterGame(you, bot) {
  for (let i = 0; i < you; i++) await pointUp(QUEUE.you).click();
  for (let i = 0; i < bot; i++) await pointUp(QUEUE.bot).click();
}

await step(
  'queue: Find a match reaches matchmaking',
  async () => {
    await ph('identifier').fill(email);
    await ph('password').fill(password);
    await btn(/^log in/i).click();
    await afterAuth('after password sign-in');
    await btn(QUEUE.findMatch).waitFor({ timeout: T }).catch(orFail('no "Find a match" on home'));
    await btn(QUEUE.findMatch).click();
    const outcome = await Promise.any([
      text(QUEUE.profileRequired).waitFor({ timeout: T }).then(() => 'profile'),
      text(QUEUE.searching).waitFor({ timeout: T }).then(() => 'searching'),
      btn(QUEUE.accept).waitFor({ timeout: T }).then(() => 'found'),
    ]).catch(orFail('Find a match showed no searching state, match or profile_required copy'));
    await shot('queue');
    if (outcome === 'profile') return 'profile_required copy shown (no public.users row for the test account)';
    await btn(QUEUE.accept).waitFor({ timeout: BOT_WAIT_MS }).catch(orFail('no Match Found screen (Demo Tester off?)'));
    await shot('match-found');
    await btn(QUEUE.accept).click();
    await text(QUEUE.on).waitFor({ timeout: T }).catch(orFail('accept did not reach "You\'re on!"'));
    await shot('match-on');
    await pointUp(QUEUE.you).waitFor({ timeout: T }).catch(orFail('no score steppers in the "You\'re on!" panel'));
    await enterGame(11, 7);
    await btn(QUEUE.addGame).click();
    await enterGame(11, 9);
    await btn(QUEUE.submit).click();
    await text(QUEUE.confirmed).waitFor({ timeout: BOT_WAIT_MS }).catch(orFail('11–7, 11–9 was not confirmed'));
    const change = await text(QUEUE.ratingChange)
      .waitFor({ timeout: T })
      .then(() => text(QUEUE.ratingChange).innerText())
      .catch(orFail('no rating change after the confirmation'));
    await shot('match-confirmed');
    await btn(QUEUE.done).click();
    await btn(QUEUE.findMatch).waitFor({ timeout: T }).catch(orFail('Done did not return to an idle queue card'));
    return `searching → Match Found → accepted → reported 11–7, 11–9 → confirmed (${change})`;
  },
  { needsAccount: true }
);

await step(
  'google return: /sso-callback sends unfinished account to onboarding',
  async () => {
    // Stand-in for finishing Google OAuth (not automatable headless): sign in,
    // clear the onboarding metadata so the account is unfinished again (like a
    // new Google account), then load the page Google redirects back to.
    await ph('identifier').fill(email);
    await ph('password').fill(password);
    await btn(/^log in/i).click();
    await afterAuth('after password sign-in');
    await setOnboarded(false);
    await page.goto(`${BASE}/sso-callback`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    const screen = await landing(120000);
    if (screen !== 'onboarding') throw new Error(`landed on ${screen}`);
    await markOnboarded();
  },
  { needsAccount: true }
);

await step(
  'phone sign-up (no password)',
  async () => {
    await link(/sign up/i).click();
    await ph('phone').waitFor({ timeout: T });
    // Test numbers are shared across runs; retry until one is free.
    for (let i = 0; i < 10 && !phone; i++) {
      const digits = `55555501${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`;
      await ph('phone').fill(digits);
      await btn(/send code/i).click();
      const ok = await text(/check your texts/i)
        .waitFor({ timeout: 15000 })
        .then(() => true)
        .catch(() => false);
      if (ok) phone = digits;
      else if (!isPhoneTaken(await alertText())) await orFail('send code failed')();
    }
    if (!phone) throw new Error('every tried test number already has an account');
    await enterCode();
    return `+1${phone}, ${await afterAuth('after phone verify')}`;
  },
  { needsAccount: true }
);

await step(
  'phone sign-in: wrong code, then correct code',
  async () => {
    if (!phone) throw new Error('no phone account from previous step');
    await ph('identifier').fill(`(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`);
    await btn(/text me a code/i).click();
    await text(/check your texts/i).waitFor({ timeout: T }).catch(orFail('no code step'));
    await enterCode('000000');
    await alert().waitFor({ timeout: T });
    const wrong = await alertText();
    await enterCode();
    return `wrong code -> "${wrong}", ${await afterAuth('after phone sign-in')}`;
  },
  { needsAccount: true }
);

await step(
  'forgot password: reset and sign in with new password',
  async () => {
    await link(/^forgot\?/i).click();
    await ph('email').fill(email);
    await btn(/send code/i).click();
    await text(/choose a new password/i).waitFor({ timeout: T }).catch(orFail('no reset step'));
    await ph('code').fill(CODE);
    await ph('password').fill(newPassword);
    await btn(/reset password/i).click();
    await afterAuth('after reset');
    await toSignInFrom(await signOut());
    await ph('identifier').fill(email);
    await ph('password').fill(newPassword);
    await btn(/^log in/i).click();
    return afterAuth('sign-in with new password');
  },
  { needsAccount: true }
);

await browser.close();

// 422s are Clerk's "account not found" responses the negative checks expect;
// the COOP line comes from the Google popup.
const expected = /status of 422|Cross-Origin-Opener-Policy|^%c/;
console.log(
  JSON.stringify(
    {
      testingToken: Boolean(testingToken),
      results,
      consoleErrors: [...new Set(errors)].filter((e) => !expected.test(e)),
    },
    null,
    2
  )
);
process.exit(results.some((r) => r.status === 'FAIL') ? 1 : 0);
