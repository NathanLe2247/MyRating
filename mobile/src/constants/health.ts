/** Wearable sources the Health tab can connect to, in display order. */
export const HealthProviders = ['apple_health', 'whoop'] as const;
export type HealthProvider = (typeof HealthProviders)[number];

/** Readiness zones, best first. */
export const ReadinessZones = ['optimal', 'moderate', 'low'] as const;
export type ReadinessZone = (typeof ReadinessZones)[number];

/** Readiness score range. */
export const ReadinessMaxScore = 100;
