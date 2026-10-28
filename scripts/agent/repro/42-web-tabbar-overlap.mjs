// Repro for #42: on web, the top tab bar covers the Home header and still
// shows the Expo template's "Expo Starter" title and "Docs" link.
//
//   node 42-web-tabbar-overlap.mjs [screenshot-dir]
//
// Run through 42-web-tabbar-overlap.sh, which starts the Expo web build and
// provides Playwright. Env: BASE_URL, CLERK_SECRET_KEY (dev instance, sk_test_).
//
// Signs in as a fresh, already-onboarded Clerk test user (created through the
// Backend API and deleted afterwards), then checks, at a phone-sized viewport:
//   - each Home header control (Doubles/Singles/Mixed, Courts, Account
//     options) is the topmost element at its own centre, i.e. not covered;
//   - every other tab's title is likewise uncovered;
//   - the tab bar shows "myRating", not "Expo Starter" / "Docs".
// Exits 1 if any check fails, 2 on a setup error.
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:8099';
const OUT = process.argv[2];
const T = 60000;
const sk = process.env.CLERK_SECRET_KEY;
if (!sk?.startsWith('sk_test_')) {
  console.error('SETUP ERROR: CLERK_SECRET_KEY must be a dev instance key (sk_test_…)');
  process.exit(2);
}

async function clerkApi(method, path, body) {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${sk}`, 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Clerk ${method} ${path}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// Onboarding-complete keys from mobile/src/constants/profile.ts.
const now = new Date().toISOString();
const user = await clerkApi('POST', '/users', {
  email_address: [`repro42-${Date.now()}+clerk_test@example.com`],
  password: `Repro42-${Math.random().toString(36).slice(2)}!`,
  public_metadata: { profileCompletedAt: now, onboardingCompletedAt: now },
});

const failures = [];
const browser = await chromium.launch();
try {
  const ticket = (await clerkApi('POST', '/sign_in_tokens', { user_id: user.id })).token;
  const testingToken = (await clerkApi('POST', '/testing_tokens')).token;
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  await page.route(/\.clerk\.accounts\.dev\/v1\//, (route) => {
    const url = new URL(route.request().url());
    url.searchParams.set('__clerk_testing_token', testingToken);
    return route.continue({ url: url.toString() });
  });

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window.Clerk?.loaded, null, { timeout: 180000 });
  const pk = await page.evaluate(() => window.Clerk.publishableKey ?? '');
  if (!pk.startsWith('pk_test_')) throw new Error('app is not on a dev Clerk instance');
  await page.evaluate(async (t) => {
    const signIn = await window.Clerk.client.signIn.create({ strategy: 'ticket', ticket: t });
    await window.Clerk.setActive({ session: signIn.createdSessionId });
  }, ticket);
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 180000 });

  // Expo Router keeps hidden screens mounted; only look at visible elements.
  const vis = (l) => l.filter({ visible: true }).first();
  const accountOptions = vis(page.getByRole('button', { name: /account options/i }));
  await accountOptions.waitFor({ timeout: T });

  // True when the element is what a click at its centre would hit.
  const uncovered = (locator) =>
    locator.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!hit && el.contains(hit);
    });
  const check = async (label, locator) => {
    if (!(await uncovered(locator))) failures.push(`${label} is covered by another element`);
  };

  await check('Home: Doubles tab', vis(page.getByRole('tab', { name: /doubles/i })));
  await check('Home: Singles tab', vis(page.getByRole('tab', { name: /singles/i })));
  await check('Home: Mixed tab', vis(page.getByRole('tab', { name: /mixed/i })));
  await check('Home: Courts button', vis(page.getByRole('button', { name: /courts/i })));
  await check('Home: Account options button', accountOptions);
  if (OUT) await page.screenshot({ path: `${OUT}/42-home.png` });

  const body = await page.locator('body').innerText();
  if (/expo starter/i.test(body)) failures.push('tab bar still says "Expo Starter"');
  if (/\bdocs\b/i.test(body)) failures.push('tab bar still has a "Docs" link');
  if (!/myrating/i.test(body)) failures.push('tab bar has no myRating branding');

  for (const name of ['Play', 'Health', 'Community']) {
    await vis(page.getByText(new RegExp(`^${name}$`, 'i'))).click();
    await page.waitForURL(new RegExp(`/${name.toLowerCase()}$`), { timeout: T });
    // The screen's title (en.comingSoon.*.title): same text as the tab
    // label, but not inside the tab bar's links.
    const title = vis(page.getByText(name, { exact: true }).and(page.locator(':not(a *)')));
    await title.waitFor({ timeout: T });
    await check(`${name}: screen title`, title);
    if (OUT) await page.screenshot({ path: `${OUT}/42-${name.toLowerCase()}.png` });
  }
} catch (e) {
  console.error(`SETUP ERROR: ${e.message.split('\n')[0]}`);
  await browser.close();
  await clerkApi('DELETE', `/users/${user.id}`).catch((err) => console.error(`cleanup: ${err.message}`));
  process.exit(2);
}
await browser.close();
await clerkApi('DELETE', `/users/${user.id}`);

if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  process.exit(1);
}
console.log('PASS Home header and tab screens uncovered; tab bar shows myRating branding');
