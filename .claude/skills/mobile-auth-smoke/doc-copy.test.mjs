// node --test .claude/skills/mobile-auth-smoke/doc-copy.test.mjs
// SKILL.md step 4 copies the driver into $DRIVER; every local module it
// imports (directly or transitively) must be copied too (#88).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

function stepFourCopiedFiles() {
  const doc = readFileSync(join(here, 'SKILL.md'), 'utf8');
  const step = doc.split(/^## /m).find((s) => /^4\.\s/.test(s));
  assert.ok(step, 'SKILL.md has a "## 4." section');
  const files = new Set();
  for (const line of step.split('\n')) {
    const m = line.match(/^\s*cp\s+(.+?)\s+\$DRIVER\/?\s*$/);
    if (!m) continue;
    for (const src of m[1].split(/\s+/)) {
      const brace = src.match(/^(.*)\{([^}]+)\}(.*)$/);
      const expanded = brace
        ? brace[2].split(',').map((p) => brace[1] + p + brace[3])
        : [src];
      for (const f of expanded) files.add(basename(f));
    }
  }
  return files;
}

function localImports(file, seen = new Set()) {
  if (seen.has(file)) return seen;
  seen.add(file);
  const src = readFileSync(join(here, file), 'utf8');
  for (const m of src.matchAll(/(?:from\s+|import\s*\(\s*)['"]\.\/([^'"]+)['"]/g)) {
    localImports(m[1], seen);
  }
  return seen;
}

test('step 4 copies auth-smoke.mjs and every local module it imports', () => {
  const copied = stepFourCopiedFiles();
  const needed = [...localImports('auth-smoke.mjs')];
  const missing = needed.filter((f) => !copied.has(f));
  assert.deepEqual(missing, [], `step 4 copies [${[...copied]}] but not [${missing}]`);
});
