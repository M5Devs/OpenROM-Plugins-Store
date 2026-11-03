import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BIO_MAX_LENGTH,
  validateBio,
  validateOptionalUrl,
} from '../src/lib/publishers.ts';
import { initialsFor, socialLinksFor } from '../src/lib/site.ts';

// --- Bio --------------------------------------------------------------------

test('accepts bios within the length limit', () => {
  assert.equal(validateBio(''), null);
  assert.equal(validateBio('Creator of things.'), null);
  assert.equal(validateBio('x'.repeat(BIO_MAX_LENGTH)), null);
});

test('rejects over-long or non-string bios', () => {
  assert.notEqual(validateBio('x'.repeat(BIO_MAX_LENGTH + 1)), null);
  assert.notEqual(validateBio(undefined), null);
  assert.notEqual(validateBio(42), null);
});

// --- Optional URLs ----------------------------------------------------------

test('treats blank optional URLs as valid (field left empty)', () => {
  assert.equal(validateOptionalUrl('', 'Website'), null);
  assert.equal(validateOptionalUrl('   ', 'Website'), null);
});

test('accepts absolute http(s) URLs', () => {
  assert.equal(validateOptionalUrl('https://example.com', 'Website'), null);
  assert.equal(validateOptionalUrl('http://example.com/x?y=1', 'Website'), null);
  assert.equal(validateOptionalUrl('https://discord.gg/abc', 'Discord'), null);
});

test('rejects non-http(s) schemes and garbage', () => {
  for (const value of [
    'javascript:alert(1)',
    'data:text/html,<script>',
    'ftp://example.com',
    'example.com', // no scheme
    'not a url',
    'https://' + 'x'.repeat(400),
  ]) {
    assert.notEqual(validateOptionalUrl(value, 'Website'), null, `${value} should be rejected`);
  }
});

test('rejects non-string optional URLs', () => {
  for (const value of [undefined, null, 42, {}, []]) {
    assert.notEqual(validateOptionalUrl(value, 'Website'), null);
  }
});

// --- Avatar initials --------------------------------------------------------

test('derives initials from a display name', () => {
  assert.equal(initialsFor('Claus Valca'), 'CV');
  assert.equal(initialsFor('M5 Devs Studio'), 'MS');
  assert.equal(initialsFor('nanook'), 'NA');
  assert.equal(initialsFor('   '), '?');
  assert.equal(initialsFor(''), '?');
});

// --- Social links -----------------------------------------------------------

test('builds social links only for populated URLs, in a stable order', () => {
  const links = socialLinksFor({
    websiteUrl: 'https://example.com',
    githubUrl: 'https://github.com/x',
    discordUrl: '',
    twitterUrl: 'https://x.com/x',
  });
  assert.deepEqual(
    links.map((link) => link.key),
    ['website', 'github', 'twitter'],
  );
  assert.equal(links[0].icon, 'globe');
  assert.equal(links[1].icon, 'github');
  assert.equal(links[2].icon, 'twitter');
});

test('returns no social links when nothing is set', () => {
  assert.deepEqual(socialLinksFor({}), []);
});
