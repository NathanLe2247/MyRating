// node --test .claude/skills/mobile-auth-smoke/retry-match.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { isPhoneTaken } from './phone-taken.mjs';

test('retries on the old "already has an account" wording', () => {
  assert.equal(isPhoneTaken('This phone number already has an account.'), true);
});

test('retries on the new "number is taken" wording (#81)', () => {
  assert.equal(isPhoneTaken('That phone number is taken. Please try another.'), true);
});

test('does not retry on other errors', () => {
  assert.equal(isPhoneTaken('Phone number is invalid.'), false);
  assert.equal(isPhoneTaken(null), false);
});
