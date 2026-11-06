import { test } from 'node:test';
import assert from 'node:assert/strict';

import { initGallery } from '../src/lib/gallery-client.ts';

/**
 * Minimal DOM stand-in — the repo has no jsdom dependency, so the element
 * behaviour `initGallery` relies on (classList, attributes, listeners) is
 * faked. The gallery logic itself is the real code.
 */
class FakeClassList {
  tokens = new Set<string>();
  private element: FakeElement;
  constructor(element: FakeElement) {
    this.element = element;
  }
  add(...t: string[]) {
    t.forEach((x) => this.tokens.add(x));
  }
  remove(...t: string[]) {
    t.forEach((x) => this.tokens.delete(x));
  }
  toggle(token: string, force?: boolean) {
    const on = force ?? !this.tokens.has(token);
    on ? this.tokens.add(token) : this.tokens.delete(token);
    return on;
  }
  contains(token: string) {
    return this.tokens.has(token);
  }
}

class FakeElement {
  attrs: Record<string, string> = {};
  children: FakeElement[] = [];
  classList: FakeClassList;
  listeners: Record<string, Array<(e: { key: string; preventDefault(): void }) => void>> = {};

  constructor(attrs: Record<string, string> = {}) {
    this.attrs = attrs;
    this.classList = new FakeClassList(this);
  }
  add(child: FakeElement) {
    this.children.push(child);
    return child;
  }
  matches(sel: string) {
    const m = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(sel);
    if (!m) throw new Error(`unsupported selector: ${sel}`);
    return m[1] in this.attrs && (m[2] === undefined || this.attrs[m[1]] === m[2]);
  }
  querySelectorAll(sel: string): FakeElement[] {
    const out: FakeElement[] = [];
    for (const c of this.children) {
      if (c.matches(sel)) out.push(c);
      out.push(...c.querySelectorAll(sel));
    }
    return out;
  }
  addEventListener(type: string, fn: (e: { key: string; preventDefault(): void }) => void) {
    (this.listeners[type] ??= []).push(fn);
  }
  dispatch(type: string, event: { key: string; preventDefault(): void }) {
    (this.listeners[type] ?? []).forEach((fn) => fn(event));
  }
  setAttribute(name: string, value: string) {
    this.attrs[name] = value;
  }
  focus() {
    /* no-op */
  }
}

function buildGallery(frameCount: number, thumbCount: number) {
  const root = new FakeElement({ 'data-gallery': '' });
  for (let i = 0; i < frameCount; i++) root.add(new FakeElement({ 'data-gallery-frame': '' }));
  for (let i = 0; i < thumbCount; i++) root.add(new FakeElement({ 'data-gallery-thumb': '' }));
  return root;
}

test('initGallery selects the first frame and marks the first thumbnail', () => {
  const root = buildGallery(3, 3);
  initGallery(root as unknown as HTMLElement);
  const frames = root.querySelectorAll('[data-gallery-frame]');
  const thumbs = root.querySelectorAll('[data-gallery-thumb]');
  assert.deepEqual(
    frames.map((f) => f.classList.contains('hidden')),
    [false, true, true],
  );
  assert.equal(thumbs[0].attrs['aria-selected'], 'true');
  assert.equal(thumbs[1].attrs['aria-selected'], 'false');
  assert.equal(thumbs[0].classList.contains('border-cyan-400'), true);
  assert.equal(thumbs[1].classList.contains('border-zinc-800'), true);
});

test('clicking a thumbnail shows its frame and only its frame', () => {
  const root = buildGallery(3, 3);
  initGallery(root as unknown as HTMLElement);
  root.querySelectorAll('[data-gallery-thumb]')[2].dispatch('click', { key: '', preventDefault() {} });
  const frames = root.querySelectorAll('[data-gallery-frame]');
  assert.deepEqual(
    frames.map((f) => f.classList.contains('hidden')),
    [true, true, false],
  );
  const thumbs = root.querySelectorAll('[data-gallery-thumb]');
  assert.equal(thumbs[2].attrs['aria-selected'], 'true');
  assert.equal(thumbs[0].attrs['aria-selected'], 'false');
  assert.equal(thumbs[2].classList.contains('border-cyan-400'), true);
  assert.equal(thumbs[0].classList.contains('border-cyan-400'), false);
});

test('arrow keys wrap around the thumbnail strip', () => {
  const root = buildGallery(3, 3);
  initGallery(root as unknown as HTMLElement);
  const thumbs = root.querySelectorAll('[data-gallery-thumb]');
  let prevented = false;
  thumbs[0].dispatch('keydown', { key: 'ArrowLeft', preventDefault: () => (prevented = true) });
  assert.equal(prevented, true);
  // Wrapped from index 0 to the last frame.
  assert.equal(root.querySelectorAll('[data-gallery-frame]')[2].classList.contains('hidden'), false);
});

test('a gallery with no thumbnails is a no-op', () => {
  const root = buildGallery(1, 0);
  initGallery(root as unknown as HTMLElement);
  assert.equal(root.querySelectorAll('[data-gallery-frame]')[0].classList.contains('hidden'), false);
});
