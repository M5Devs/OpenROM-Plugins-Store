import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SESSION_TTL_SECONDS,
  createSessionToken,
  verifySessionToken,
  type SessionUser,
} from '../src/lib/session.ts';
import {
  isVerifiableFor,
  validatePublisherId,
  validatePublisherName,
} from '../src/lib/publishers.ts';

const ENV = { SESSION_SECRET: 'test-secret-value' };
const OTHER_ENV = { SESSION_SECRET: 'a-different-secret' };
const USER: SessionUser = {
  githubId: '42',
  githubUsername: 'nanook',
  name: 'Nanook',
  avatarUrl: 'https://avatars.githubusercontent.com/u/42',
};

// --- Session tokens ---------------------------------------------------------

test('round-trips a signed session token', async () => {
  const token = await createSessionToken(USER, ENV);
  assert.ok(token, 'token should be created when a secret is configured');

  const payload = await verifySessionToken(token, ENV);
  assert.equal(payload?.githubId, '42');
  assert.equal(payload?.githubUsername, 'nanook');
  assert.equal(payload?.name, 'Nanook');
  assert.equal(payload?.avatarUrl, USER.avatarUrl);
  assert.equal(typeof payload?.iat, 'number');
});

test('returns null when no signing secret is configured', async () => {
  assert.equal(await createSessionToken(USER, {}), null);
  assert.equal(await createSessionToken(USER, undefined), null);
  assert.equal(await verifySessionToken('anything.signed', {}), null);
});

test('falls back to GITHUB_CLIENT_SECRET when SESSION_SECRET is absent', async () => {
  const env = { GITHUB_CLIENT_SECRET: 'fallback-secret' };
  const token = await createSessionToken(USER, env);
  assert.ok(token);
  assert.equal((await verifySessionToken(token, env))?.githubId, '42');
});

test('rejects a token signed with a different secret', async () => {
  const token = await createSessionToken(USER, ENV);
  assert.equal(await verifySessionToken(token, OTHER_ENV), null);
});

test('rejects a tampered payload', async () => {
  const token = (await createSessionToken(USER, ENV))!;
  const [encoded, signature] = token.split('.');

  const forged = Buffer.from(
    JSON.stringify({ ...USER, githubId: '999', githubUsername: 'admin', iat: Math.floor(Date.now() / 1000) }),
  )
    .toString('base64url');

  assert.equal(await verifySessionToken(`${forged}.${signature}`, ENV), null);
  assert.equal(await verifySessionToken(`${encoded}.deadbeef`, ENV), null);
});

test('rejects malformed tokens', async () => {
  for (const bad of ['', 'no-dot', '.', 'a.', '.b', 'not-base64.%%%']) {
    assert.equal(await verifySessionToken(bad, ENV), null, `should reject ${JSON.stringify(bad)}`);
  }
});

test('rejects an expired token', async () => {
  const issued = Date.now() - (SESSION_TTL_SECONDS + 60) * 1000;
  const token = (await createSessionToken(USER, ENV, issued))!;
  assert.equal(await verifySessionToken(token, ENV), null);
});

test('accepts a token issued within the TTL window', async () => {
  const issued = Date.now() - (SESSION_TTL_SECONDS - 60) * 1000;
  const token = (await createSessionToken(USER, ENV, issued))!;
  assert.equal((await verifySessionToken(token, ENV))?.githubId, '42');
});

test('rejects a token with an iat in the future', async () => {
  const issued = Date.now() + 60 * 1000;
  const token = (await createSessionToken(USER, ENV, issued))!;
  assert.equal(await verifySessionToken(token, ENV), null);
});

// --- Publisher slug validation ---------------------------------------------

test('accepts well-formed publisher ids', () => {
  for (const id of ['nanook', 'm5devs', 'claus-valca', 'abc123', 'a1']) {
    assert.equal(validatePublisherId(id), null, `${id} should be valid`);
  }
});

test('rejects malformed publisher ids', () => {
  for (const id of [
    '',
    'A',
    'Nanook',
    'nanook!',
    '-nanook',
    'nanook-',
    'nan--ook',
    'nan ook',
    'a'.repeat(40),
  ]) {
    assert.notEqual(validatePublisherId(id), null, `${JSON.stringify(id)} should be rejected`);
  }
});

test('rejects non-string publisher ids', () => {
  for (const id of [undefined, null, 42, {}, []]) {
    assert.notEqual(validatePublisherId(id), null);
  }
});

test('validates publisher display names', () => {
  assert.equal(validatePublisherName('M5 Devs'), null);
  assert.notEqual(validatePublisherName(''), null);
  assert.notEqual(validatePublisherName('a'), null);
  assert.notEqual(validatePublisherName('x'.repeat(81)), null);
  assert.notEqual(validatePublisherName(123), null);
});

// --- Auto-verify rule -------------------------------------------------------

test('auto-verifies only when the slug matches the GitHub username', () => {
  assert.equal(isVerifiableFor('nanook', 'nanook'), true);
  assert.equal(isVerifiableFor('nanook', 'Nanook'), true);
  assert.equal(isVerifiableFor('NANOOK', 'nanook'), true);
  assert.equal(isVerifiableFor('nanook-dev', 'nanook'), false);
  assert.equal(isVerifiableFor('someoneelse', 'nanook'), false);
  assert.equal(isVerifiableFor('', ''), true); // empty slug can never be created
});
