import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadPublisherProfile } from '../src/lib/publisher-profile.ts';

// --- Minimal D1 stand-in ----------------------------------------------------
//
// `loadPublisherProfile`'s whole job is to turn a thrown D1 error into a value the
// page can render, so the failure path is the interesting one and it needs a real
// thrower. D1 is an external boundary, so it is faked here; the code under test is
// the helper itself, which runs for real.

const PUBLISHER_ROW = {
  id: 'clausvalca',
  name: 'Claus Valca (M5 Dev)',
  owner_github_id: '193546948',
  verified: 1,
  created_at: '2026-10-01 00:00:00',
  bio: '',
  avatar_url: '',
  banner_url: '',
  website_url: '',
  github_url: '',
  discord_url: '',
  twitter_url: '',
};

const PLUGIN_ROW = {
  id: 'iso-to-wua',
  name: 'ISO to WUA',
  version: '1.0.0',
  min_core_version: '0.5.0',
  publisher_id: 'clausvalca',
  publisher_name: 'Claus Valca (M5 Dev)',
  publisher_verified: 1,
  category: 'Utility',
  description: 'Converts ISO images to WUA.',
  readme_markdown: null,
  routes_json: '["ISO -> WUA"]',
  platforms_json: '["Windows"]',
  download_url: 'https://example.com/iso-to-wua.zip',
  sha256: 'abc',
  icon: null,
  downloads: 7,
  created_at: '2026-10-01 00:00:00',
};

interface FakeDbOptions {
  /** Make every query throw, as a missing table or dropped binding would. */
  throwOnQuery?: boolean;
  publisherRow?: typeof PUBLISHER_ROW | null;
  pluginRows?: (typeof PLUGIN_ROW)[];
}

/** Dispatches on the SQL text, which is enough to tell the three queries apart. */
function fakeDb(options: FakeDbOptions = {}): D1Database {
  const { throwOnQuery = false, publisherRow = PUBLISHER_ROW, pluginRows = [PLUGIN_ROW] } = options;

  const run = (sql: string): unknown => {
    if (throwOnQuery) {
      throw new Error('D1_ERROR: no such table: publishers: SQLITE_ERROR');
    }
    if (/COUNT\(\*\)/i.test(sql)) {
      return {
        total_plugins: pluginRows.length,
        total_downloads: pluginRows.reduce((sum, row) => sum + row.downloads, 0),
      };
    }
    if (/FROM\s+publishers/i.test(sql)) {
      return publisherRow;
    }
    if (/FROM\s+plugins\s+p/i.test(sql)) {
      return pluginRows;
    }
    throw new Error(`Unexpected query in test: ${sql}`);
  };

  const statement = (sql: string) => ({
    bind: () => ({
      first: async () => run(sql),
      all: async () => ({ results: run(sql) ?? [] }),
    }),
    first: async () => run(sql),
    all: async () => ({ results: run(sql) ?? [] }),
  });

  return { prepare: (sql: string) => statement(sql) } as unknown as D1Database;
}

// --- loadPublisherProfile ---------------------------------------------------

test('reports a database failure instead of throwing (the 500 regression)', async () => {
  const result = await loadPublisherProfile(fakeDb({ throwOnQuery: true }), 'clausvalca');
  assert.equal(result.status, 'error');
});

test('a binding that cannot be resolved at all is reported, not thrown', async () => {
  // `getDB()` throws when the DB binding is missing. Passing a getter keeps that
  // throw inside the guarded boundary; passing a resolved value would not.
  const result = await loadPublisherProfile(() => {
    throw new Error('D1 binding "DB" is unavailable.');
  }, 'clausvalca');
  assert.equal(result.status, 'error');
});

test('accepts a plain binding as well as a getter', async () => {
  const result = await loadPublisherProfile(fakeDb(), 'clausvalca');
  assert.equal(result.status, 'ok');
});

test('reports a missing publisher distinctly from a database failure', async () => {
  const result = await loadPublisherProfile(fakeDb({ publisherRow: null }), 'nobody');
  assert.equal(result.status, 'not-found');
});

test('returns the composed profile on success', async () => {
  const result = await loadPublisherProfile(fakeDb(), 'clausvalca');
  assert.equal(result.status, 'ok');
  if (result.status !== 'ok') return;
  assert.equal(result.profile.publisher.id, 'clausvalca');
  assert.equal(result.profile.publisher.verified, true);
  assert.equal(result.profile.stats.totalPlugins, 1);
  assert.equal(result.profile.stats.totalDownloads, 7);
  assert.equal(result.profile.plugins.length, 1);
  assert.deepEqual(result.profile.plugins[0].routes, ['ISO -> WUA']);
});

test('a publisher with no extensions still resolves to an empty profile', async () => {
  const result = await loadPublisherProfile(fakeDb({ pluginRows: [] }), 'clausvalca');
  assert.equal(result.status, 'ok');
  if (result.status !== 'ok') return;
  assert.deepEqual(result.profile.plugins, []);
  assert.equal(result.profile.stats.totalDownloads, 0);
});
