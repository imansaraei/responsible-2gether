import { isValidTimeZone } from './schedule';

export interface StoredSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  tz: string;
}

// Only the browsers' own push services. Anything else would let a caller make this
// Worker POST to an arbitrary URL every reminder slot.
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,            // Chrome, Edge, Samsung Internet
  /^updates\.push\.services\.mozilla\.com$/,
  /(^|\.)push\.apple\.com$/,           // Safari / iOS home-screen apps
  /\.notify\.windows\.com$/,
];

const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;
// Cloudflare KV metadata is capped at 1024 bytes; subscriptions live there so the cron
// can read them all with a single list() call.
export const MAX_METADATA_BYTES = 1024;

export function parseSubscribeBody(x: unknown): StoredSubscription | null {
  if (typeof x !== 'object' || x === null) return null;
  const { subscription, timeZone } = x as Record<string, unknown>;
  if (typeof subscription !== 'object' || subscription === null) return null;
  const { endpoint, keys } = subscription as Record<string, unknown>;
  if (typeof endpoint !== 'string' || !isPushEndpoint(endpoint)) return null;
  if (typeof keys !== 'object' || keys === null) return null;
  const { p256dh, auth } = keys as Record<string, unknown>;
  if (!isKey(p256dh, 120) || !isKey(auth, 40)) return null;
  if (!isValidTimeZone(timeZone)) return null;
  const stored: StoredSubscription = { endpoint, keys: { p256dh, auth }, tz: timeZone };
  return new TextEncoder().encode(JSON.stringify(stored)).length <= MAX_METADATA_BYTES ? stored : null;
}

export function isPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  return url.protocol === 'https:' && !url.port && PUSH_HOSTS.some((h) => h.test(url.hostname));
}

const isKey = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= max && BASE64URL.test(v);

// One KV entry per device, keyed by a hash of its endpoint so re-subscribing overwrites.
export async function subscriptionKey(endpoint: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return 'sub:' + [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
