import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_IMAGE_BYTES,
  imageDimensions,
  validateImageDataUrl,
  AVATAR_LIMITS,
  BANNER_LIMITS,
} from '../src/lib/image.ts';
import { validateImageOrUrl } from '../src/lib/media.ts';
import { toUserProfile, type UserRow } from '../src/lib/users.ts';

// --- Image fixtures ---------------------------------------------------------

/** A real 1x1 transparent PNG. */
const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/** Minimal RIFF/VP8X container declaring an arbitrary canvas size (no pixels needed). */
function webpVp8x(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(30);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) bytes[offset + i] = text.charCodeAt(i);
  };
  write(0, 'RIFF');
  bytes[4] = 30 - 8; // RIFF size (unchecked by the parser)
  write(8, 'WEBP');
  write(12, 'VP8X');
  bytes[16] = 10; // chunk size
  const w = width - 1;
  const h = height - 1;
  bytes[24] = w & 0xff;
  bytes[25] = (w >> 8) & 0xff;
  bytes[26] = (w >> 16) & 0xff;
  bytes[27] = h & 0xff;
  bytes[28] = (h >> 8) & 0xff;
  bytes[29] = (h >> 16) & 0xff;
  return bytes;
}

function toDataUrl(bytes: Uint8Array, mime: string): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:${mime};base64,${btoa(binary)}`;
}

// --- Dimension parsing ------------------------------------------------------

test('reads PNG dimensions from the header', () => {
  const info = imageDimensions(Uint8Array.from(atob(PNG_1X1), (c) => c.charCodeAt(0)));
  assert.deepEqual(info, { width: 1, height: 1, format: 'png' });
});

test('reads VP8X WebP canvas dimensions', () => {
  const info = imageDimensions(webpVp8x(1200, 400));
  assert.equal(info?.format, 'webp');
  assert.equal(info?.width, 1200);
  assert.equal(info?.height, 400);
});

test('returns null for bytes that are not a known image', () => {
  assert.equal(imageDimensions(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8])), null);
});

// --- Data URL validation ----------------------------------------------------

test('accepts a real PNG data URL', () => {
  assert.equal(validateImageDataUrl(`data:image/png;base64,${PNG_1X1}`, 'Avatar'), null);
});

test('treats an empty value as "no image"', () => {
  assert.equal(validateImageDataUrl('', 'Avatar'), null);
  assert.equal(validateImageDataUrl(null, 'Avatar'), null);
});

test('rejects non-data URLs and unsupported types', () => {
  assert.notEqual(validateImageDataUrl('https://example.com/a.png', 'Avatar'), null);
  assert.notEqual(validateImageDataUrl('data:image/gif;base64,R0lGOD', 'Avatar'), null);
  assert.notEqual(validateImageDataUrl('data:text/html;base64,PHNjcmlwdD4=', 'Avatar'), null);
});

test('rejects an image whose bytes disagree with its declared type', () => {
  // PNG bytes labelled as WebP.
  assert.notEqual(validateImageDataUrl(`data:image/webp;base64,${PNG_1X1}`, 'Avatar'), null);
});

test('rejects images over the byte cap', () => {
  const oversized = `data:image/webp;base64,${'A'.repeat(Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 8)}`;
  const error = validateImageDataUrl(oversized, 'Banner');
  assert.match(String(error), /too large/i);
});

test('enforces per-field dimension limits', () => {
  const wide = toDataUrl(webpVp8x(1200, 400), 'image/webp');
  assert.equal(validateImageDataUrl(wide, 'Banner', BANNER_LIMITS), null);
  assert.notEqual(validateImageDataUrl(wide, 'Avatar', AVATAR_LIMITS), null);

  const tall = toDataUrl(webpVp8x(600, 2000), 'image/webp');
  assert.notEqual(validateImageDataUrl(tall, 'Banner', BANNER_LIMITS), null);
  assert.notEqual(validateImageDataUrl(tall, 'Avatar', AVATAR_LIMITS), null);
});

// --- Combined media validation ----------------------------------------------

test('validateImageOrUrl routes data URLs to the image validator', () => {
  assert.equal(validateImageOrUrl(`data:image/png;base64,${PNG_1X1}`, 'Avatar', AVATAR_LIMITS), null);
  assert.notEqual(validateImageOrUrl('data:image/gif;base64,R0lGOD', 'Avatar', AVATAR_LIMITS), null);
});

test('validateImageOrUrl still accepts plain http(s) URLs', () => {
  assert.equal(validateImageOrUrl('https://example.com/a.png', 'Avatar', AVATAR_LIMITS), null);
  assert.notEqual(validateImageOrUrl('javascript:alert(1)', 'Avatar', AVATAR_LIMITS), null);
  assert.notEqual(validateImageOrUrl('data:text/html;base64,PHNjcmlwdD4=', 'Avatar', AVATAR_LIMITS), null);
});

// --- User profile overlay ---------------------------------------------------

const SESSION = {
  githubId: '42',
  githubUsername: 'octocat',
  name: 'The Octocat',
  avatarUrl: 'https://avatars.githubusercontent.com/u/42',
};

function row(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: 1,
    github_id: '42',
    github_username: 'octocat',
    name: 'The Octocat',
    avatar_url: 'https://avatars.githubusercontent.com/u/42',
    created_at: '2026-01-01T00:00:00Z',
    profile_customized: 0,
    ...overrides,
  };
}

test('falls back to the GitHub identity until the profile is customized', () => {
  const profile = toUserProfile(SESSION, row());
  assert.equal(profile.name, 'The Octocat');
  assert.equal(profile.avatarUrl, 'https://avatars.githubusercontent.com/u/42');
  assert.equal(profile.customized, false);
});

test('a customized profile wins over the GitHub identity', () => {
  const custom = 'data:image/webp;base64,AAAA';
  const profile = toUserProfile(
    SESSION,
    row({ profile_customized: 1, name: 'Claus', avatar_url: custom }),
  );
  assert.equal(profile.name, 'Claus');
  assert.equal(profile.avatarUrl, custom);
  assert.equal(profile.customized, true);
});

test('an empty custom value falls back to GitHub rather than showing blank', () => {
  const profile = toUserProfile(SESSION, row({ profile_customized: 1, name: '', avatar_url: null }));
  assert.equal(profile.name, 'The Octocat');
  assert.equal(profile.avatarUrl, 'https://avatars.githubusercontent.com/u/42');
});

test('falls back to the username when no name is available anywhere', () => {
  const profile = toUserProfile({ ...SESSION, name: null, avatarUrl: null }, null);
  assert.equal(profile.name, 'octocat');
  assert.equal(profile.avatarUrl, '');
});
