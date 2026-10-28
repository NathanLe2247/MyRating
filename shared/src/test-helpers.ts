// Test-only: not exported from index.ts.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const migrationsDir = fileURLToPath(new URL('../../backend/supabase/migrations/', import.meta.url));

/**
 * Values of the first `create type public.<name> as enum (...)` found in the
 * migrations (files in name order). Only reads that statement: values added
 * later with `alter type ... add value` (or renames/drops) are NOT picked up,
 * so extend this when a migration first alters an enum.
 */
export function readEnumFromMigrations(name: string): string[] {
  const pattern = new RegExp(`create\\s+type\\s+public\\.${name}\\s+as\\s+enum\\s*\\(([^)]*)\\)`, 'i');
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    const match = pattern.exec(readFileSync(migrationsDir + file, 'utf8'));
    if (match?.[1]) return [...match[1].matchAll(/'([^']*)'/g)].map((m) => m[1] as string);
  }
  throw new Error(`enum public.${name} not found in ${migrationsDir}`);
}
