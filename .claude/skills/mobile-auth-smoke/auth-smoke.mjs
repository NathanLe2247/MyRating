// Auth smoke test for the mobile app's Expo web build.
//
//   node auth-smoke.mjs <screenshot-dir>
//
// Env:
//   BASE_URL          default http://localhost:8099
//   CLERK_SECRET_KEY  sk_test_… — mints a Clerk testing token so sign-up gets
//                     past bot protection. Without it, account flows are
//                     reported as skipped.
//   CLERK_TESTING_TOKEN  use an already-minted token instead.
//
// Uses Clerk dev-instance test credentials: `+clerk_test` emails and
// +1 555-555-01xx phones, which accept code 424242 and send nothing.
import { chromium } from 'playwright';

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

async function mintTestingToken() {
  if (process.env.CLERK_TESTING_TOKEN) return process.env.CLERK_TESTING_TOKEN;
  const sk = process.env.CLERK_SECRET_KEY;
  if (!sk) return null;
  const res = await fetch('https://api.clerk.com/v1/testing_tokens', {
    method: 'POST',
    headers: { Authorization: `Bearer ${sk}` },
  });
  if (!res.ok) throw new Error(`testing token request failed: ${res.status} ${await res.text()}`);
  return (await res.json()).token;
}

const testingToken = await mintTestingToken();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
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
page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

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

// Which screen `/` lands on. Signed out, the app starts on sign-up (older
// builds started on sign-in); signed in, it's home or onboarding step 1.
const SCREENS = {
  signIn: /welcome back/i,
  signUp: /join myrating/i,
  // Dashboard home (older builds: the template home with a "Sign out" row).
  home: /recent matches|sign out/i,
  onboarding: /create your profile/i,
};
async function landing(timeout, only = Object.keys(SCREENS)) {
  return Promise.any(
    only.map((name) => [name, SCREENS[name]]).map(([name, re]) =>
      text(re)
        .waitFor({ timeout })
        .then(() => name)
    )
  ).catch(() => null);
}

// Every step starts signed out on sign-in, whatever `/` lands on.
async function toSignIn() {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
  let screen = await landing(120000);
  if (screen === 'onboarding') screen = await skipOnboarding();
  if (screen === 'home') screen = await signOut();
  if (screen === 'signUp') await link(/^log in/i).click();
  await text(SCREENS.signIn).waitFor({ timeout: T });
}
// Signs out through clerk-js (exposed as window.Clerk on web). The dashboard
// only offers sign-out behind its options menu (a browser confirm on web), and
// the floating tab bar can cover controls, so the UI path isn't reliable here.
async function signOut() {
  await page.evaluate(() => window.Clerk.signOut());
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
  return landing(T);
}
// "Skip for now" only writes Clerk unsafeMetadata, so it works without the
// player-profile edge function being deployed.
async function skipOnboarding() {
  await btn(/skip for now/i).click();
  await text(SCREENS.home).waitFor({ timeout: T });
  return 'home';
}
// After any sign-up or sign-in, an account without a completed profile goes
// to onboarding step 1 (a skip only lasts for that session); builds without
// onboarding go straight home. Skips it and returns which path was taken.
async function afterAuth(what) {
  // Only signed-in screens: the auth form stays visible while it submits.
  const screen = await landing(T, ['onboarding', 'home']);
  if (screen === 'onboarding') {
    await skipOnboarding();
    return 'via onboarding step 1 (skipped)';
  }
  if (screen !== 'home') await orFail(`${what}: not on onboarding or home`)();
  return 'straight to home';
}
async function enterCode(code = CODE) {
  await ph('code').fill(code);
  await btn(/^verify/i).click();
}

const results = [];
let n = 0;
async function step(name, fn, { needsAccount = false } = {}) {
  if (needsAccount && !testingToken) {
    results.push({ name, status: 'skip', note: 'no CLERK_SECRET_KEY / CLERK_TESTING_TOKEN' });
    return;
  }
  try {
    await toSignIn();
    results.push({ name, status: 'pass', note: (await fn()) ?? '' });
  } catch (e) {
    results.push({ name, status: 'FAIL', note: e.message.split('\n')[0] });
  }
  const file = `${String(++n).padStart(2, '0')}-${name.replace(/\W+/g, '-').replace(/-$/, '').toLowerCase()}.png`;
  await page.screenshot({ path: `${OUT}/${file}` }).catch(() => {});
}

// ---------------------------------------------------------------- no account

await step('start: signed-out landing screen', async () => {
  // step() has already signed out and moved to sign-in; reload to see where
  // a fresh signed-out visit lands.
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const screen = await landing(120000);
  if (screen !== 'signUp' && screen !== 'signIn') throw new Error(`landed on ${screen}`);
  return `lands on ${screen === 'signUp' ? 'sign-up' : 'sign-in'}`;
});

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
  await text(SCREENS.signUp).waitFor({ timeout: T });
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
    return afterAuth('after password sign-in');
  },
  { needsAccount: true }
);

await step(
  'google return: /sso-callback sends unfinished account to onboarding',
  async () => {
    // Stand-in for finishing Google OAuth (not automatable headless): sign in,
    // then load the page Google redirects back to.
    await ph('identifier').fill(email);
    await ph('password').fill(password);
    await btn(/^log in/i).click();
    await landing(T, ['onboarding', 'home']);
    await page.goto(`${BASE}/sso-callback`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    const screen = await landing(120000);
    if (screen !== 'onboarding') throw new Error(`landed on ${screen}`);
    await skipOnboarding();
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
      else if (!/already has an account/i.test((await alertText()) ?? '')) await orFail('send code failed')();
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
    if ((await signOut()) === 'signUp') await link(/^log in/i).click();
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
