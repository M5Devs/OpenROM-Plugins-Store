/**
 * Visitor OS detection and plugin compatibility.
 *
 * The same pure functions run in two places:
 *   - the server, against the request's `User-Agent`, so the compatibility pill
 *     is already correct on first paint (no layout shift), and
 *   - the browser, against `navigator.userAgent`, as the authoritative check.
 *
 * Keeping one implementation means the two can never disagree about what a UA
 * string means.
 */

export type DetectedOS = 'Windows' | 'macOS' | 'Linux' | 'Android' | 'iOS' | 'Unknown';

/**
 * `compatible` / `incompatible` are claims we can defend from a UA string.
 * `unknown` is the honest answer when we cannot tell — the caller renders
 * nothing rather than guessing.
 */
export type Compatibility = 'compatible' | 'incompatible' | 'unknown';

/** A plugin tagged with this runs everywhere; it is a storefront convention, not a real OS. */
export const ALL_PLATFORMS = 'All Platforms';

/**
 * The storefront label each OS matches in `platforms_json`.
 * `null` means the storefront never publishes a build for that platform, so a
 * plugin can never be compatible with it (iOS ships no `.orplug` binaries).
 */
const PLATFORM_LABEL: Record<DetectedOS, string | null> = {
  Windows: 'Windows',
  macOS: 'macOS',
  Linux: 'Linux',
  Android: 'Android',
  iOS: null,
  Unknown: null,
};

export interface DetectOptions {
  /**
   * `navigator.maxTouchPoints`. iPadOS 13+ reports a desktop `Macintosh`
   * User-Agent, so the only client-side tell is a touch-capable "Mac". The
   * server cannot see this, which is exactly why the browser re-checks.
   */
  maxTouchPoints?: number;
}

/**
 * Classify a User-Agent string. Order matters: an Android UA also contains
 * "Linux", and ChromeOS contains "Linux" too, so the more specific tokens are
 * tested first.
 */
export function detectOS(
  userAgent: string | null | undefined,
  options: DetectOptions = {},
): DetectedOS {
  const ua = (userAgent ?? '').toLowerCase();
  if (!ua) return 'Unknown';

  if (ua.includes('android')) return 'Android';
  if (/(iphone|ipod)/.test(ua)) return 'iOS';
  // An explicit "iPad" UA (older iPadOS) also contains "like Mac OS X", so it
  // must be tested before the Mac branch below.
  if (ua.includes('ipad')) return 'iOS';

  const looksLikeMac = ua.includes('mac os x') || ua.includes('macintosh');
  if (looksLikeMac) {
    // An iPad in desktop mode (iPadOS 13+) reports a desktop Safari UA with no
    // "iPad" token; a touch-capable "Macintosh" is the only tell.
    if ((options.maxTouchPoints ?? 0) > 1) return 'iOS';
    return 'macOS';
  }

  if (ua.includes('windows')) return 'Windows';
  // ChromeOS UAs end in "CrOS ... Linux", so treat them as Linux desktops.
  if (ua.includes('linux') || ua.includes('x11') || ua.includes('cros')) return 'Linux';

  return 'Unknown';
}

/**
 * Decide whether a plugin supports the detected OS.
 *
 * An empty platform list means we have no compatibility data to stand on, so we
 * say `unknown` instead of implying the plugin works everywhere.
 */
export function compatibilityFor(
  detected: DetectedOS,
  platforms: readonly string[] | null | undefined,
): Compatibility {
  if (detected === 'Unknown') return 'unknown';

  const list = (platforms ?? []).filter((platform): platform is string => Boolean(platform));
  if (list.length === 0) return 'unknown';
  if (list.includes(ALL_PLATFORMS)) return 'compatible';

  const label = PLATFORM_LABEL[detected];
  if (!label) return 'incompatible';
  return list.includes(label) ? 'compatible' : 'incompatible';
}

/** Human-readable "Only available on: …" list, in the order the plugin declares. */
export function supportedLabel(platforms: readonly string[] | null | undefined): string {
  return (platforms ?? []).filter(Boolean).join(', ');
}
