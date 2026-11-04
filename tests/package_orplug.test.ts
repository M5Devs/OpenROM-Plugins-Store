import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = new URL('../scripts/package_orplug.py', import.meta.url).pathname;

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/** Build a throwaway stage dir with a manifest and one executable. */
function makeStage(): string {
  const dir = mkdtempSync(join(tmpdir(), 'orplug-stage-'));
  writeFileSync(join(dir, 'plugin.json'), JSON.stringify({ id: 'nkit', version: '3.2.0' }));
  mkdirSync(join(dir, 'bin'), { recursive: true });
  writeFileSync(join(dir, 'bin', 'nkit'), '#!/bin/sh\necho nkit\n', { mode: 0o755 });
  return dir;
}

function pack(stage: string, out: string): void {
  execFileSync('python3', [SCRIPT, stage, out], { stdio: 'pipe' });
}

// --- Packaging ---------------------------------------------------------------

test('produces a byte-identical archive across runs', () => {
  const stage = makeStage();
  const tmp = mkdtempSync(join(tmpdir(), 'orplug-out-'));
  try {
    const a = join(tmp, 'a.orplug');
    const b = join(tmp, 'b.orplug');
    pack(stage, a);
    pack(stage, b);
    assert.equal(sha256(a), sha256(b), 'same input must yield the same digest');
  } finally {
    rmSync(stage, { recursive: true, force: true });
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('keeps plugin.json at the archive root', () => {
  const stage = makeStage();
  const tmp = mkdtempSync(join(tmpdir(), 'orplug-out-'));
  const out = join(tmp, 'x.orplug');
  try {
    pack(stage, out);
    const listing = execFileSync('python3', [
      '-c',
      `import zipfile,sys;print("\\n".join(zipfile.ZipFile(sys.argv[1]).namelist()))`,
      out,
    ])
      .toString()
      .trim()
      .split('\n');
    assert.ok(listing.includes('plugin.json'), 'manifest must be at the root');
    assert.ok(listing.includes('bin/nkit'), 'nested binaries keep their path');
  } finally {
    rmSync(stage, { recursive: true, force: true });
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('refuses a stage directory without plugin.json', () => {
  const dir = mkdtempSync(join(tmpdir(), 'orplug-bad-'));
  const tmp = mkdtempSync(join(tmpdir(), 'orplug-out-'));
  try {
    assert.throws(() => pack(dir, join(tmp, 'x.orplug')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(tmp, { recursive: true, force: true });
  }
});
