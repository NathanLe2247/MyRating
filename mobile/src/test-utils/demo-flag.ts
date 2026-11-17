// Turns the dev-only demo data flag (`DevPreviews.demoData()`) on or off for
// one describe block, restoring the env var afterwards.
export function withDemoDataFlag(on: boolean) {
  let previous: string | undefined;
  beforeEach(() => {
    previous = process.env.EXPO_PUBLIC_DEMO_DATA;
    if (on) process.env.EXPO_PUBLIC_DEMO_DATA = '1';
    else delete process.env.EXPO_PUBLIC_DEMO_DATA;
  });
  afterEach(() => {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_DEMO_DATA;
    else process.env.EXPO_PUBLIC_DEMO_DATA = previous;
  });
}
