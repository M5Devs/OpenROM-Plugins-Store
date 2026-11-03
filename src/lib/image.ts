/**
 * Shared image helpers used by both the browser (to optimize an upload) and the
 * server (to validate whatever the client sends before it reaches D1).
 *
 * Everything here is pure: base64 math, PNG/JPEG/WebP header parsing, and byte
 * budgets. No DOM or Node APIs, so the same module runs in the worker and in a
 * `<script>`.
 */

/** The three formats the file inputs accept. */
export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

/**
 * Hard cap on an uploaded image. Well under D1's 2 MB per-row limit so a row with
 * both a publisher avatar and a banner stays comfortably within it, and small
 * enough that the images stay cheap to store and fast to serve inline.
 */
export const MAX_IMAGE_BYTES = 1_500_000;

export const AVATAR_MAX_DIMENSION = 512;
export const BANNER_MAX_DIMENSION = 1600;

/** WebP lossy quality for avatars and banners. */
export const AVATAR_QUALITY = 0.85;
export const BANNER_QUALITY = 0.82;

export interface ImageLimits {
  maxBytes: number;
  maxDimension: number;
}

export const AVATAR_LIMITS: ImageLimits = {
  maxBytes: MAX_IMAGE_BYTES,
  maxDimension: AVATAR_MAX_DIMENSION,
};
export const BANNER_LIMITS: ImageLimits = {
  maxBytes: MAX_IMAGE_BYTES,
  maxDimension: BANNER_MAX_DIMENSION,
};

// --- base64 ----------------------------------------------------------------

/** Bytes of a `data:` URL, or `null` when the string is not a base64 data URL. */
function dataUrlToBytes(value: string): Uint8Array | null {
  const match = /^data:([a-z]+\/[a-z0-9.+-]+)?;base64,(.*)$/is.exec(value);
  if (!match) return null;
  try {
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** Byte length of the payload inside a base64 data URL, without decoding it. */
export function base64PayloadBytes(value: string): number | null {
  const comma = value.indexOf(',');
  if (comma < 0) return null;
  const payload = value.slice(comma + 1).replace(/\s/g, '');
  if (payload.length === 0) return 0;
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  return Math.floor((payload.length * 3) / 4) - padding;
}

// --- sniffing --------------------------------------------------------------

function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  );
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isWebp(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 && // "RIFF"
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50 // "WEBP"
  );
}

function readUint16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint24LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) >>> 0) +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  );
}

function readUint16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

export interface ImageInfo {
  width: number;
  height: number;
  format: 'png' | 'jpeg' | 'webp';
}

/** Parse intrinsic dimensions from the file header, or `null` if unrecognized. */
export function imageDimensions(bytes: Uint8Array): ImageInfo | null {
  if (isPng(bytes) && bytes.length >= 24) {
    return { width: readUint32BE(bytes, 16), height: readUint32BE(bytes, 20), format: 'png' };
  }

  if (isWebp(bytes)) {
    const fourCc = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
    if (fourCc === 'VP8 ' && bytes.length >= 30) {
      // Lossy VP8: 14-byte frame header, then 3-byte little-endian dimensions.
      return {
        width: readUint16LE(bytes, 26) & 0x3fff,
        height: readUint16LE(bytes, 28) & 0x3fff,
        format: 'webp',
      };
    }
    if (fourCc === 'VP8L' && bytes.length >= 25) {
      // Lossless VP8L packs 14-bit (width-1) and (height-1) into 4 bytes.
      const bits =
        bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | ((bytes[24] << 24) >>> 0);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
        format: 'webp',
      };
    }
    if (fourCc === 'VP8X' && bytes.length >= 30) {
      return {
        width: readUint24LE(bytes, 24) + 1,
        height: readUint24LE(bytes, 27) + 1,
        format: 'webp',
      };
    }
    return null;
  }

  if (isJpeg(bytes)) {
    // Walk the marker segments until a Start-Of-Frame (SOFn) carries the size.
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }
      const length = readUint16BE(bytes, offset + 2);
      const isSof =
        marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) {
        return {
          height: readUint16BE(bytes, offset + 5),
          width: readUint16BE(bytes, offset + 7),
          format: 'jpeg',
        };
      }
      if (length < 2) break;
      offset += 2 + length;
    }
    return null;
  }

  return null;
}

// --- validation ------------------------------------------------------------

/**
 * Validate a `data:image/...;base64,...` URL for storage. The declared MIME type
 * and the real magic bytes must agree — a PNG renamed to `.webp` is rejected — and
 * the decoded size and dimensions must fit the given limits.
 *
 * `null` means "no image" and is always allowed (the field is simply cleared).
 */
export function validateImageDataUrl(
  value: unknown,
  label: string,
  limits: ImageLimits = AVATAR_LIMITS,
): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return `${label} must be an image data URL or empty.`;

  const match = /^data:(image\/[a-z0-9.+-]+);base64,/i.exec(value);
  if (!match) {
    return `${label} must be a base64 data URL (PNG, JPEG, or WebP).`;
  }

  const declared = match[1].toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.includes(declared as AllowedImageType)) {
    return `${label} must be a PNG, JPEG, or WebP image.`;
  }

  const payloadBytes = base64PayloadBytes(value);
  if (payloadBytes === null) return `${label} is not valid base64.`;
  if (payloadBytes > limits.maxBytes) {
    return `${label} is too large — the limit is ${Math.round(limits.maxBytes / 1000)} KB.`;
  }

  const bytes = dataUrlToBytes(value);
  if (!bytes || bytes.length === 0) return `${label} is not valid base64.`;

  const info = imageDimensions(bytes);
  if (!info) return `${label} could not be read as an image.`;
  if (declared !== `image/${info.format}`) {
    return `${label} does not match its declared format.`;
  }
  if (info.width > limits.maxDimension || info.height > limits.maxDimension) {
    return `${label} is too large — the longest edge must be ${limits.maxDimension}px or less.`;
  }
  if (info.width < 1 || info.height < 1) return `${label} has invalid dimensions.`;

  return null;
}
