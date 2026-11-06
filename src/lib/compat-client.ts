/**
 * Browser entry for the plugin compatibility pill.
 *
 * The server renders the pill from the request `User-Agent` so the layout is
 * final on first paint. This re-runs the same check against
 * `navigator.userAgent` and corrects the pill if the two disagree — the usual
 * cause being iPadOS in desktop mode, which reports a Macintosh User-Agent but
 * is really iOS.
 *
 * Corrections only ever toggle `hidden` on nodes that are always in the DOM, so
 * a correction cannot change the element's height and shift the layout.
 *
 * This module touches the DOM, so it is only imported from `<script>` blocks
 * (which Vite bundles for the client); it must never be imported from server code.
 */

import { compatibilityFor, detectOS, supportedLabel, type Compatibility } from './detectOS.ts';

/** Base shell classes, kept in sync with the server-rendered markup. */
const SHELL_BASE = 'rounded-xl border p-4';
const SHELL_VARIANT: Record<Exclude<Compatibility, 'unknown'>, string> = {
  compatible: 'border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_25px_rgba(16,185,129,0.15)]',
  incompatible: 'border-amber-500/40 bg-amber-500/10 shadow-[0_0_25px_rgba(245,158,11,0.12)]',
};

function setHidden(element: Element | null, hidden: boolean): void {
  if (element) element.classList.toggle('hidden', hidden);
}

function apply(root: HTMLElement, state: Compatibility, os: string, platforms: string[]): void {
  root.dataset.compatState = state;

  const shell = root.querySelector<HTMLElement>('[data-compat-shell]');
  if (shell) {
    shell.className =
      state === 'unknown' ? `${SHELL_BASE} hidden` : `${SHELL_BASE} ${SHELL_VARIANT[state]}`;
  }

  setHidden(root.querySelector('[data-compat-icon="compatible"]'), state !== 'compatible');
  setHidden(root.querySelector('[data-compat-icon="incompatible"]'), state !== 'incompatible');
  setHidden(root.querySelector('[data-compat-supported]'), state !== 'incompatible');
  // Sits below the action buttons, outside this root, so it is matched globally.
  setHidden(document.querySelector('[data-compat-download-anyway]'), state !== 'incompatible');

  const text = root.querySelector<HTMLElement>('[data-compat-text]');
  if (text) {
    text.textContent =
      state === 'compatible'
        ? `✅ Compatible with your system (${os})`
        : state === 'incompatible'
          ? `⚠️ Not compatible with your current OS (${os})`
          : '';
    text.classList.toggle('text-emerald-300', state === 'compatible');
    text.classList.toggle('text-amber-300', state === 'incompatible');
  }

  const supported = root.querySelector<HTMLElement>('[data-compat-platforms]');
  if (supported) supported.textContent = supportedLabel(platforms);
}

export function initCompatibility(root: HTMLElement): void {
  const platforms = (root.dataset.platforms ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  const os = detectOS(navigator.userAgent, { maxTouchPoints: navigator.maxTouchPoints });
  apply(root, compatibilityFor(os, platforms), os, platforms);
}
