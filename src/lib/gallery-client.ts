/**
 * Screenshot gallery interaction for a theme listing.
 *
 * The server renders the gallery with the first screenshot already selected, so
 * the page is correct before any JavaScript runs. This module only swaps which
 * image the featured frame shows and which thumbnail is marked as selected.
 *
 * All screenshots are rendered up front and toggled with `hidden` — nothing is
 * inserted or removed, and no image is fetched lazily on click. Swapping a
 * `src` on demand would leave a blank frame while the new image loaded; keeping
 * every frame in the DOM means a click is instant.
 *
 * DOM-touching code lives in this module so it can be imported from a `<script>`
 * block only, never from server code.
 */

const SELECTED = 'border-cyan-400';
const UNSELECTED = 'border-zinc-800';

/** Show the frame and thumbnail matching `index`, and hide the rest. */
function select(root: HTMLElement, index: number): void {
  const frames = root.querySelectorAll<HTMLElement>('[data-gallery-frame]');
  const thumbs = root.querySelectorAll<HTMLElement>('[data-gallery-thumb]');

  frames.forEach((frame, i) => frame.classList.toggle('hidden', i !== index));
  thumbs.forEach((thumb, i) => {
    const active = i === index;
    thumb.setAttribute('aria-selected', active ? 'true' : 'false');
    thumb.classList.toggle(SELECTED, active);
    thumb.classList.toggle(UNSELECTED, !active);
  });
}

/** Wire a single gallery root. Safe to call when the gallery is absent. */
export function initGallery(root: HTMLElement): void {
  const thumbs = [...root.querySelectorAll<HTMLElement>('[data-gallery-thumb]')];
  if (thumbs.length === 0) return;

  thumbs.forEach((thumb, index) => {
    thumb.addEventListener('click', () => select(root, index));
    // Arrow keys move between thumbnails when the strip has focus.
    thumb.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      const next = event.key === 'ArrowRight' ? index + 1 : index - 1;
      const wrapped = (next + thumbs.length) % thumbs.length;
      thumbs[wrapped].focus();
      select(root, wrapped);
    });
  });

  select(root, 0);
}
