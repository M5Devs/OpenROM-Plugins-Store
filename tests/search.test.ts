import { test } from 'node:test';
import assert from 'node:assert/strict';

import { searchPlugins, type PluginRow } from '../src/lib/db.ts';

// --- Minimal D1 stand-in ----------------------------------------------------
// D1 is an external boundary, so it is faked here; the code under test
// (`searchPlugins`) is real. The fake records the SQL and the bound values so the
// test can assert on how the query is built — most importantly that the search
// term is *bound*, never spliced into the statement.

interface Capture {
  sql: string;
  bindings: unknown[];
}

function fakeDb(rows: PluginRow[], capture: Capture): D1Database {
  const statement = (sql: string) => ({
    bind: (...values: unknown[]) => {
      capture.sql = sql;
      capture.bindings = values;
      return {
        all: async () => ({ results: rows }),
        first: async () => rows[0] ?? null,
      };
    },
    all: async () => ({ results: rows }),
    first: async () => rows[0] ?? null,
  });
  return { prepare: (sql: string) => statement(sql) } as unknown as D1Database;
}

function row(overrides: Partial<PluginRow> = {}): PluginRow {
  return {
    id: 'nkit',
    name: 'NKit',
    version: '3.2.0',
    min_core_version: '3.9.0',
    publisher_id: 'm5devs',
    publisher_name: 'M5 Dev',
    publisher_verified: 1,
    category: 'Nintendo',
    description: 'Disc Restoration Suite',
    readme_markdown: null,
    routes_json: null,
    platforms_json: null,
    download_url: 'https://example.test/nkit.orplug',
    sha256: 'abc',
    icon: null,
    downloads: 0,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

test('searchPlugins binds the lowercased term wrapped in wildcards', async () => {
  const capture: Capture = { sql: '', bindings: [] };
  await searchPlugins(fakeDb([row()], capture), 'NKit');

  assert.deepEqual(capture.bindings, ['%nkit%']);
});

test('searchPlugins matches name, description and category case-insensitively', async () => {
  const capture: Capture = { sql: '', bindings: [] };
  await searchPlugins(fakeDb([], capture), 'x');

  const sql = capture.sql.toLowerCase();
  assert.match(sql, /lower\(p\.name\) like \?1/);
  assert.match(sql, /lower\(coalesce\(p\.description, ''\)\) like \?1/);
  assert.match(sql, /lower\(p\.category\) like \?1/);
});

test('searchPlugins reuses the shared plugin source so publisher name/verified resolve', async () => {
  const capture: Capture = { sql: '', bindings: [] };
  await searchPlugins(fakeDb([], capture), 'x');

  assert.match(capture.sql, /LEFT JOIN publishers pub ON pub\.id = p\.publisher_id/i);
});

test('searchPlugins never splices the raw term into the SQL text', async () => {
  const capture: Capture = { sql: '', bindings: [] };
  const payload = "'; DROP TABLE plugins; --";
  await searchPlugins(fakeDb([], capture), payload);

  assert.equal(capture.sql.includes('DROP TABLE'), false);
  assert.deepEqual(capture.bindings, [`%${payload.toLowerCase()}%`]);
});

test('searchPlugins maps rows through toPlugin (publisher name + verified flag)', async () => {
  const capture: Capture = { sql: '', bindings: [] };
  const [plugin] = await searchPlugins(fakeDb([row()], capture), 'nkit');

  assert.equal(plugin.id, 'nkit');
  assert.equal(plugin.name, 'NKit');
  assert.equal(plugin.publisherName, 'M5 Dev');
  assert.equal(plugin.publisherVerified, true);
});

test('searchPlugins returns an empty array when nothing matches', async () => {
  const capture: Capture = { sql: '', bindings: [] };
  const plugins = await searchPlugins(fakeDb([], capture), 'zzzznomatch');

  assert.deepEqual(plugins, []);
});
