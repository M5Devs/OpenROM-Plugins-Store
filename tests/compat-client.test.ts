import { test } from 'node:test';
import assert from 'node:assert/strict';

import { initCompatibility } from '../src/lib/compat-client.ts';

/**
 * A deliberately tiny DOM stand-in. Node has no DOM and this repo has no jsdom
 * dependency, so the element behaviour `initCompatibility` relies on — attribute
 * lookup, `classList` toggling, `className`, `dataset` and `textContent` — is
 * faked here. The detection and compatibility logic it calls is the real code.
 */
class FakeClassList {
  constructor(element: FakeElement) {
    this.element = element;
  }
  private element: FakeElement;
  add(...tokens: string[]) {
    for (const token of tokens) this.element.tokens.add(token);
  }
  remove(...tokens: string[]) {
    for (const token of tokens) this.element.tokens.delete(token);
  }
  toggle(token: string, force?: boolean) {
    const on = force ?? !this.element.tokens.has(token);
    if (on) this.element.tokens.add(token);
    else this.element.tokens.delete(token);
    return on;
  }
  contains(token: string) {
    return this.element.tokens.has(token);
  }
}

class FakeElement {
  attrs: Record<string, string> = {};
  children: FakeElement[] = [];
  tokens = new Set<string>();
  dataset: Record<string, string> = {};
  textContent = '';
  classList = new FakeClassList(this);

  constructor(attrs: Record<string, string> = {}) {
    this.attrs = attrs;
  }

  add(child: FakeElement): FakeElement {
    this.children.push(child);
    return child;
  }

  get className(): string {
    return [...this.tokens].join(' ');
  }
  set className(value: string) {
    this.tokens = new Set(value.split(/\s+/).filter(Boolean));
  }

  /** Supports the two selector shapes the client uses: `[data-x]` and `[data-x="v"]`. */
  private matches(selector: string): boolean {
    const match = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(selector);
    if (!match) throw new Error(`unsupported selector in test: ${selector}`);
    const [, name, value] = match;
    if (!(name in this.attrs)) return false;
    return value === undefined || this.attrs[name] === value;
  }

  querySelectorAll(selector: string): FakeElement[] {
    const found: FakeElement[] = [];
    for (const child of this.children) {
      if (child.matches(selector)) found.push(child);
      found.push(...child.querySelectorAll(selector));
    }
    return found;
  }

  querySelector(selector: string): FakeElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

/** Mirror the markup the plugin page renders, so the selectors must line up. */
function buildTree() {
  const root = new FakeElement({ 'data-compat': '' });
  root.dataset.platforms = 'Windows,Linux';

  const shell = root.add(new FakeElement({ 'data-compat-shell': '' }));
  const iconCompatible = shell.add(new FakeElement({ 'data-compat-icon': 'compatible' }));
  const iconIncompatible = shell.add(new FakeElement({ 'data-compat-icon': 'incompatible' }));
  const text = shell.add(new FakeElement({ 'data-compat-text': '' }));
  const supported = shell.add(new FakeElement({ 'data-compat-supported': '' }));
  supported.add(new FakeElement({ 'data-compat-platforms': '' }));

  const downloadAnyway = new FakeElement({ 'data-compat-download-anyway': '' });

  // The client looks the "download anyway" node up globally because it sits
  // outside the `[data-compat]` root; the stub only needs that one query.
  const document = {
    querySelector: (selector: string) =>
      selector === '[data-compat-download-anyway]' ? downloadAnyway : null,
  };

  return { root, shell, iconCompatible, iconIncompatible, text, supported, downloadAnyway, document };
}

function withNavigator(userAgent: string, maxTouchPoints: number) {
  Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent, maxTouchPoints },
    configurable: true,
  });
}

const LINUX_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/141 Safari/537.36';
const MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';

function run(userAgent: string, maxTouchPoints = 0) {
  const tree = buildTree();
  withNavigator(userAgent, maxTouchPoints);
  (globalThis as Record<string, unknown>).document = tree.document;
  initCompatibility(tree.root as unknown as HTMLElement);
  return tree;
}

test('client renders the compatible state and hides the warning nodes', () => {
  const t = run(LINUX_UA);
  assert.equal(t.root.dataset.compatState, 'compatible');
  assert.equal(t.shell.classList.contains('hidden'), false);
  assert.equal(t.shell.classList.contains('border-emerald-500/40'), true);
  assert.equal(t.iconCompatible.classList.contains('hidden'), false);
  assert.equal(t.iconIncompatible.classList.contains('hidden'), true);
  assert.equal(t.supported.classList.contains('hidden'), true);
  assert.equal(t.downloadAnyway.classList.contains('hidden'), true);
  assert.equal(t.text.textContent, '✅ Compatible with your system (Linux)');
  assert.equal(t.text.classList.contains('text-emerald-300'), true);
});

test('client flips to the incompatible state when the OS is not supported', () => {
  // Server would have said compatible for a Windows list; the client corrects it.
  const t = run(MAC_UA);
  assert.equal(t.root.dataset.compatState, 'incompatible');
  assert.equal(t.shell.classList.contains('border-amber-500/40'), true);
  assert.equal(t.iconCompatible.classList.contains('hidden'), true);
  assert.equal(t.iconIncompatible.classList.contains('hidden'), false);
  assert.equal(t.supported.classList.contains('hidden'), false);
  assert.equal(t.downloadAnyway.classList.contains('hidden'), false);
  assert.equal(t.text.textContent, '⚠️ Not compatible with your current OS (macOS)');
  assert.equal(t.text.classList.contains('text-amber-300'), true);
});

test('client corrects a Macintosh UA to iOS on a touch-capable device', () => {
  // iPadOS 13+ reports a desktop Macintosh UA; maxTouchPoints is the only tell.
  const t = run(MAC_UA, 5);
  assert.equal(t.root.dataset.compatState, 'incompatible');
  assert.equal(t.text.textContent, '⚠️ Not compatible with your current OS (iOS)');
});

test('client hides everything when the UA cannot be identified', () => {
  const t = run('curl/8.7.1');
  assert.equal(t.root.dataset.compatState, 'unknown');
  assert.equal(t.shell.classList.contains('hidden'), true);
  assert.equal(t.downloadAnyway.classList.contains('hidden'), true);
  assert.equal(t.text.textContent, '');
});
