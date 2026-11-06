import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ALL_PLATFORMS,
  compatibilityFor,
  detectOS,
  supportedLabel,
} from '../src/lib/detectOS.ts';

// Real User-Agent strings, trimmed to the parts that matter.
const UA = {
  windows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  macOS:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  linux:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  android:
    'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  ipadLegacy:
    'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  chromeOS:
    'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  firefoxLinux:
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0',
};

test('detectOS classifies the common desktop and mobile platforms', () => {
  assert.equal(detectOS(UA.windows), 'Windows');
  assert.equal(detectOS(UA.macOS), 'macOS');
  assert.equal(detectOS(UA.linux), 'Linux');
  assert.equal(detectOS(UA.firefoxLinux), 'Linux');
  assert.equal(detectOS(UA.android), 'Android');
  assert.equal(detectOS(UA.iphone), 'iOS');
});

test('detectOS prefers Android over the Linux token it also carries', () => {
  // An Android UA contains "Linux"; the more specific token must win.
  assert.match(UA.android, /Linux/);
  assert.equal(detectOS(UA.android), 'Android');
});

test('detectOS treats ChromeOS as a Linux desktop', () => {
  assert.equal(detectOS(UA.chromeOS), 'Linux');
});

test('detectOS recognises an explicit iPad UA as iOS', () => {
  assert.equal(detectOS(UA.ipadLegacy), 'iOS');
});

test('detectOS reads a touch-capable Macintosh as iPadOS, not macOS', () => {
  // iPadOS 13+ reports a desktop Safari UA; only maxTouchPoints gives it away.
  assert.equal(detectOS(UA.macOS), 'macOS');
  assert.equal(detectOS(UA.macOS, { maxTouchPoints: 0 }), 'macOS');
  assert.equal(detectOS(UA.macOS, { maxTouchPoints: 5 }), 'iOS');
  // A real Mac with a trackpad reports 0 touch points, so it stays macOS.
  assert.equal(detectOS(UA.macOS, { maxTouchPoints: 1 }), 'macOS');
});

test('detectOS returns Unknown for missing or unrecognised agents', () => {
  for (const value of [null, undefined, '', 'curl/8.7.1', 'SomeCrawler/1.0']) {
    assert.equal(detectOS(value), 'Unknown', `${value} should be Unknown`);
  }
});

test('compatibilityFor matches the OS against the platform list', () => {
  const saturn = ['Windows', 'Linux'];
  assert.equal(compatibilityFor('Windows', saturn), 'compatible');
  assert.equal(compatibilityFor('Linux', saturn), 'compatible');
  assert.equal(compatibilityFor('macOS', saturn), 'incompatible');
  assert.equal(compatibilityFor('Android', saturn), 'incompatible');
});

test('compatibilityFor treats All Platforms as compatible everywhere', () => {
  for (const os of ['Windows', 'macOS', 'Linux', 'Android'] as const) {
    assert.equal(compatibilityFor(os, [ALL_PLATFORMS]), 'compatible');
  }
  // A theme tagged All Platforms alongside a real OS is still compatible.
  assert.equal(compatibilityFor('macOS', [ALL_PLATFORMS, 'Windows']), 'compatible');
});

test('compatibilityFor is Unknown when we cannot judge', () => {
  // No platform data at all — do not claim compatibility.
  assert.equal(compatibilityFor('Windows', []), 'unknown');
  assert.equal(compatibilityFor('Windows', null), 'unknown');
  assert.equal(compatibilityFor('Windows', undefined), 'unknown');
  // An unreadable UA cannot be judged even with a full platform list.
  assert.equal(compatibilityFor('Unknown', ['Windows', 'Linux']), 'unknown');
});

test('compatibilityFor never claims compatibility for iOS', () => {
  // The storefront ships no iOS builds, so iOS is always incompatible.
  assert.equal(compatibilityFor('iOS', ['Windows', 'Linux', 'macOS']), 'incompatible');
  assert.equal(compatibilityFor('iOS', [ALL_PLATFORMS]), 'compatible');
});

test('supportedLabel joins the declared platforms in order', () => {
  assert.equal(supportedLabel(['Windows', 'Linux']), 'Windows, Linux');
  assert.equal(supportedLabel(['Windows']), 'Windows');
  assert.equal(supportedLabel([]), '');
  assert.equal(supportedLabel(null), '');
});
