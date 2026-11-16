// Dev-only preview switches. Every flag here is false in production builds
// (`__DEV__` is false there) and off by default in dev; turn one on with its
// env var in `.env.local`.

export const DevPreviews = {
  /**
   * Sample Community groups, chat and Discover results, and a simulated Apple
   * Health connection, all from `src/constants/demo-data.ts`. For demo
   * recordings only; on with `EXPO_PUBLIC_DEMO_DATA=1`.
   *
   * A function, not a value, so tests can flip the env var per test. The var
   * is read by its full name: Expo only inlines static
   * `process.env.EXPO_PUBLIC_*` accesses into the bundle.
   */
  demoData: (): boolean => __DEV__ && process.env.EXPO_PUBLIC_DEMO_DATA === '1',
} as const;
