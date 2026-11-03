/**
 * Validation for user-supplied media references (avatars and banners).
 *
 * These fields accept either an uploaded image — a base64 data URL produced by the
 * client optimizer — or a plain absolute http(s) URL. Anything else (notably
 * `javascript:` and `data:text/html`) is rejected, so the value can safely be
 * rendered into an `src`.
 */

import { validateImageDataUrl, type ImageLimits } from './image.ts';
import { validateOptionalUrl } from './publishers.ts';

export function validateImageOrUrl(
  value: unknown,
  label: string,
  limits: ImageLimits,
): string | null {
  if (typeof value === 'string' && value.trim().toLowerCase().startsWith('data:')) {
    return validateImageDataUrl(value, label, limits);
  }
  return validateOptionalUrl(value, label);
}
