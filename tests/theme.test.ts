import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  THEME_CATEGORY,
  THEME_PLATFORM,
  isHexColor,
  isTheme,
  themePalette,
  themeSwatches,
  contrastText,
  themeApplyUri,
  orskinFileName,
} from '../src/lib/theme.ts';

const PALETTE = ['#0d0e15', '#161926', '#e94560', '#00f0ff', '#ffffff'];

test('isTheme matches only the Themes category', () => {
  assert.equal(isTheme(THEME_CATEGORY), true);
  assert.equal(isTheme('Themes '), false);
  assert.equal(isTheme('Nintendo'), false);
  assert.equal(isTheme(null), false);
  assert.equal(isTheme(undefined), false);
});

test('isHexColor accepts 3/4/6/8-digit hex in either case', () => {
  for (const value of ['#fff', '#FFFF', '#0d0e15', '#0D0E15FF', '  #abc123  ']) {
    assert.equal(isHexColor(value), true, `${value} should be valid`);
  }
});

test('isHexColor rejects anything that could escape a style attribute', () => {
  const attacks = [
    'red',
    'rgb(1,2,3)',
    '#12',
    '#12345',
    '#1234567',
    '#gggggg',
    '#fff;background:url(evil)',
    'url(javascript:alert(1))',
    'expression(alert(1))',
    '#fff" onload="alert(1)',
    '#fff;}body{display:none',
    'var(--x)',
    '',
  ];
  for (const value of attacks) {
    assert.equal(isHexColor(value), false, `${value} must be rejected`);
  }
  assert.equal(isHexColor(123 as unknown as string), false);
  assert.equal(isHexColor(null as unknown as string), false);
});

test('themePalette maps the launch palette onto named roles', () => {
  const palette = themePalette(PALETTE);
  assert.deepEqual(palette, [
    { role: 'Background', hex: '#0d0e15' },
    { role: 'Surface', hex: '#161926' },
    { role: 'Accent', hex: '#e94560' },
    { role: 'Text', hex: '#ffffff' },
  ]);
});

test('themePalette drops invalid entries so nothing unsafe reaches a template', () => {
  const palette = themePalette(['#0d0e15', 'red; background:url(x)', '#e94560', 'nope', '#ffffff']);
  assert.deepEqual(
    palette.map((entry) => entry.hex),
    ['#0d0e15', '#e94560', '#ffffff', '#ffffff'],
  );
});

test('themePalette returns empty for a palette with no valid colours', () => {
  assert.deepEqual(themePalette(['not-a-colour', 'rgb(0,0,0)']), []);
  assert.deepEqual(themePalette([]), []);
  assert.deepEqual(themePalette(null), []);
  assert.deepEqual(themePalette(undefined), []);
});

test('themePalette repeats the last colour when the palette is short', () => {
  const palette = themePalette(['#111111', '#222222']);
  assert.deepEqual(
    palette.map((entry) => entry.hex),
    ['#111111', '#222222', '#222222', '#222222'],
  );
});

test('themeSwatches filters invalid colours and caps the count', () => {
  assert.deepEqual(themeSwatches(PALETTE), PALETTE);
  assert.deepEqual(themeSwatches(PALETTE, 2), ['#0d0e15', '#161926']);
  assert.deepEqual(themeSwatches(['#abc', 'evil', '#def']), ['#abc', '#def']);
  assert.deepEqual(themeSwatches(null), []);
});

test('contrastText picks a readable foreground for light and dark backgrounds', () => {
  assert.equal(contrastText('#ffffff'), '#0b0b0f');
  assert.equal(contrastText('#0d0e15'), '#ffffff');
  assert.equal(contrastText('#00f0ff'), '#0b0b0f');
  assert.equal(contrastText('#e94560'), '#ffffff');
});

test('contrastText falls back to white for an invalid colour', () => {
  assert.equal(contrastText('url(evil)'), '#ffffff');
});

test('themeApplyUri and orskinFileName build the deep link and file name', () => {
  assert.equal(themeApplyUri('cyberpunk-neon'), 'openrom://theme/cyberpunk-neon');
  assert.equal(orskinFileName('cyberpunk-neon'), 'cyberpunk-neon.orskin');
});

test('THEME_PLATFORM is the OS-agnostic label the migration uses', () => {
  assert.equal(THEME_PLATFORM, 'All Platforms');
});
