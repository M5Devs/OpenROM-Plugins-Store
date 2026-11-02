/** Shared storefront constants and presentation helpers. */

export const SITE = {
  name: 'OpenROM Marketplace',
  tagline: 'Extensions for the OpenROM preservation toolchain',
  description:
    'Community-built extensions for OpenROM — conversion, verification, and patching tools for retro-gaming preservation.',
  github: 'https://github.com/M5Devs/OpenROM-Plugins-Store',
  discord: 'https://discord.gg/FYEjpcFYXc',
  contributing:
    'https://github.com/M5Devs/OpenROM-Plugins-Store/blob/main/CONTRIBUTING.md',
} as const;

/** Shown when the catalog is genuinely empty — never replaced with fake rows. */
export const EMPTY_STATE = {
  title: 'No community extensions published yet',
  body: 'Be the first to build for OpenROM!',
  cta: 'Read the submission guide',
} as const;

export const PLATFORM_ICONS: Record<string, string> = {
  Windows: 'monitor',
  Linux: 'terminal',
  macOS: 'apple',
  Android: 'smartphone',
};

/** Stable display order; unknown categories are appended alphabetically. */
export const CATEGORY_ORDER = [
  'Nintendo',
  'PlayStation',
  'Sega',
  'Xbox',
  'Patchers',
  'Utility',
];

export function orderCategories(categories: string[]): string[] {
  const unique = [...new Set(categories)];
  return unique.sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
}
