// @vitest-environment node
import worker, { handleApi, REMINDER_PAYLOAD, sendDueReminders, sendPush, type Env } from './index';
import { subscriptionKey, type StoredSubscription } from './subscriptions';

// Minimal in-memory KV with metadata and pagination, enough for the Worker's usage.
function fakeKV(pageSize = 1000) {
  const store = new Map<string, { value: string; metadata?: unknown }>();
  const kv = {
    store,
    async put(key: string, value: string, opts?: { metadata?: unknown }) {
      store.set(key, { value, metadata: opts?.metadata });
    },
    async delete(key: string) {
      store.delete(key);
    },
    async list({ prefix = '', cursor }: { prefix?: string; cursor?: string } = {}) {
      const names = [...store.keys()].filter((k) => k.startsWith(prefix)).sort();
      const start = cursor ? Number(cursor) : 0;
      const slice = names.slice(start, start + pageSize);
      const done = start + pageSize >= names.length;
      return {
        keys: slice.map((name) => ({ name, metadata: store.get(name)!.metadata })),
        list_complete: done,
        cursor: done ? undefined : String(start + pageSize),
      };
    },
  };
  return kv;
}

const keys = { p256dh: 'B' + 'a'.repeat(86), auth: 'tBHItJI5svbpez7KI4CCXg' };
const sub = (id: string, tz: string): StoredSubscription => ({
  endpoint: `https://fcm.googleapis.com/fcm/send/${id}`, keys, tz,
});
const makeEnv = (kv = fakeKV()) =>
  ({ SUBS: kv, ASSETS: { fetch: vi.fn(async () => new Response('asset')) }, VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: '', VAPID_CONTACT: 'https://2gether.imansaraei.com' }) as unknown as Env & { SUBS: ReturnType<typeof fakeKV> };

const post = (path: string, body: unknown) =>
  new Request(`https://2gether.imansaraei.com${path}`, { method: 'POST', body: JSON.stringify(body) });

describe('API', () => {
  test('subscribe stores the device in metadata, keyed by endpoint hash', async () => {
    const env = makeEnv();
    const s = sub('abc', 'Asia/Tehran');
    const res = await handleApi(post('/api/push/subscribe', { subscription: { endpoint: s.endpoint, keys }, timeZone: s.tz }), env);
    expect(res.status).toBe(204);
    expect(env.SUBS.store.get(await subscriptionKey(s.endpoint))?.metadata).toEqual(s);
  });

  test('re-subscribing the same device overwrites rather than duplicates (time zone change)', async () => {
    const env = makeEnv();
    const s = sub('abc', 'Asia/Tehran');
    await handleApi(post('/api/push/subscribe', { subscription: { endpoint: s.endpoint, keys }, timeZone: 'Asia/Tehran' }), env);
    await handleApi(post('/api/push/subscribe', { subscription: { endpoint: s.endpoint, keys }, timeZone: 'Europe/London' }), env);
    expect(env.SUBS.store.size).toBe(1);
    expect((env.SUBS.store.values().next().value!.metadata as StoredSubscription).tz).toBe('Europe/London');
  });

  test('invalid subscribe bodies are rejected without writing', async () => {
    const env = makeEnv();
    expect((await handleApi(post('/api/push/subscribe', { subscription: { endpoint: 'https://evil.example', keys }, timeZone: 'UTC' }), env)).status).toBe(400);
    expect((await handleApi(new Request('https://x/api/push/subscribe', { method: 'POST', body: 'not json' }), env)).status).toBe(400);
    expect((await handleApi(new Request('https://x/api/push/subscribe', { method: 'POST', body: 'x'.repeat(5000) }), env)).status).toBe(400);
    expect(env.SUBS.store.size).toBe(0);
  });

  test('unsubscribe forgets the device', async () => {
    const env = makeEnv();
    const s = sub('abc', 'UTC');
    await env.SUBS.put(await subscriptionKey(s.endpoint), '1', { metadata: s });
    expect((await handleApi(post('/api/push/unsubscribe', { endpoint: s.endpoint }), env)).status).toBe(204);
    expect(env.SUBS.store.size).toBe(0);
  });

  test('only POST to known routes', async () => {
    const env = makeEnv();
    expect((await handleApi(new Request('https://x/api/push/subscribe'), env)).status).toBe(405);
    expect((await handleApi(post('/api/other', {}), env)).status).toBe(404);
  });

  test('non-API paths are served from static assets', async () => {
    const env = makeEnv();
    const res = await worker.fetch(new Request('https://2gether.imansaraei.com/index.html'), env);
    expect(await res.text()).toBe('asset');
  });
});

describe('sendDueReminders', () => {
  test('sends only to devices where it is 10:00–10:14 or 22:00–22:14 locally, across pages', async () => {
    const env = makeEnv(fakeKV(2));
    for (const s of [sub('tehran', 'Asia/Tehran'), sub('london', 'Europe/London'), sub('tokyo', 'Asia/Tokyo'), sub('utc', 'UTC')]) {
      await env.SUBS.put(await subscriptionKey(s.endpoint), '1', { metadata: s });
    }
    const send = vi.fn(async (_s: StoredSubscription) => 201);
    // 06:30 UTC = 10:00 Tehran; 07:30 London (BST); 15:30 Tokyo; 06:30 UTC.
    const r = await sendDueReminders(new Date('2026-10-13T06:30:00Z'), env, send);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].tz).toBe('Asia/Tehran');
    expect(r).toEqual({ sent: 1, removed: 0, failed: 0 });
  });

  test('forgets devices the push service reports as gone (404/410), keeps others on errors', async () => {
    const env = makeEnv();
    const subs = [sub('gone', 'UTC'), sub('expired', 'UTC'), sub('flaky', 'UTC'), sub('ok', 'UTC')];
    for (const s of subs) await env.SUBS.put(await subscriptionKey(s.endpoint), '1', { metadata: s });
    const status: Record<string, number> = { gone: 410, expired: 404, flaky: 500, ok: 201 };
    const send = vi.fn(async (s: StoredSubscription) => status[s.endpoint.split('/').pop()!]);
    const r = await sendDueReminders(new Date('2026-10-13T22:05:00Z'), env, send);
    expect(r).toEqual({ sent: 1, removed: 2, failed: 1 });
    expect(env.SUBS.store.size).toBe(2);
  });

  test('a throwing send counts as failed and does not stop the others', async () => {
    const env = makeEnv();
    for (const s of [sub('a', 'UTC'), sub('b', 'UTC')]) await env.SUBS.put(await subscriptionKey(s.endpoint), '1', { metadata: s });
    const send = vi.fn<(s: StoredSubscription) => Promise<number>>().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(201);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await sendDueReminders(new Date('2026-10-13T10:00:00Z'), env, send)).toEqual({ sent: 1, removed: 0, failed: 1 });
  });
});

describe('sendPush (real aes128gcm encryption and VAPID signing)', () => {
  const b64url = (buf: ArrayBuffer | Uint8Array) =>
    Buffer.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).toString('base64url');
  const utf8 = (s: string) => new TextEncoder().encode(s);
  const hkdf = async (salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number) => {
    const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8));
  };

  // RFC 8291 §3.4: what the browser does when the push arrives.
  async function decrypt(body: Uint8Array, devicePrivate: CryptoKey, devicePublicRaw: Uint8Array, authSecret: Uint8Array) {
    const salt = body.slice(0, 16);
    const idlen = body[20];
    const asPublicRaw = body.slice(21, 21 + idlen);
    const ciphertext = body.slice(21 + idlen);
    const asPublic = await crypto.subtle.importKey('raw', asPublicRaw, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    // Cloudflare's types spell the ECDH param `$public`; Node's WebCrypto expects the standard `public`.
    const ecdh = { name: 'ECDH', public: asPublic } as unknown as SubtleCryptoDeriveKeyAlgorithm;
    const shared = new Uint8Array(await crypto.subtle.deriveBits(ecdh, devicePrivate, 256));
    const keyInfo = new Uint8Array([...utf8('WebPush: info\0'), ...devicePublicRaw, ...asPublicRaw]);
    const ikm = await hkdf(authSecret, shared, keyInfo, 32);
    const cek = await hkdf(salt, ikm, utf8('Content-Encoding: aes128gcm\0'), 16);
    const nonce = await hkdf(salt, ikm, utf8('Content-Encoding: nonce\0'), 12);
    const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
    const padded = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, aes, ciphertext));
    const end = padded.lastIndexOf(2); // last-record delimiter, followed by zero padding
    return new TextDecoder().decode(padded.slice(0, end));
  }

  test('the device can decrypt the reminder, and the request is VAPID-signed', async () => {
    const vapid = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
    const vapidPublic = b64url(await crypto.subtle.exportKey('raw', vapid.publicKey) as ArrayBuffer);
    const vapidPrivate = (await crypto.subtle.exportKey('jwk', vapid.privateKey) as JsonWebKey).d!;

    const device = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
    const devicePublicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', device.publicKey) as ArrayBuffer);
    const authSecret = crypto.getRandomValues(new Uint8Array(16));
    const target: StoredSubscription = {
      endpoint: 'https://web.push.apple.com/device-1',
      keys: { p256dh: b64url(devicePublicRaw), auth: b64url(authSecret) },
      tz: 'UTC',
    };

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 201 }));
    const env = { ...makeEnv(), VAPID_PUBLIC_KEY: vapidPublic, VAPID_PRIVATE_KEY: vapidPrivate } as Env;
    expect(await sendPush(target, env)).toBe(201);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(target.endpoint);
    const headers = new Headers(init.headers);
    expect(headers.get('content-encoding')).toBe('aes128gcm');
    expect(headers.get('ttl')).toBe('3600');
    expect(headers.get('topic')).toBe('daily-reminder');
    const [, jwt, k] = headers.get('authorization')!.match(/^vapid t=([\w-]+\.[\w-]+\.[\w-]+), k=([\w-]+)$/)!;
    expect(k).toBe(vapidPublic);
    const claims = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());
    expect(claims.aud).toBe('https://web.push.apple.com');
    expect(claims.sub).toBe('https://2gether.imansaraei.com');

    const plaintext = await decrypt(new Uint8Array(init.body as Uint8Array), device.privateKey, devicePublicRaw, authSecret);
    expect(JSON.parse(plaintext)).toEqual(REMINDER_PAYLOAD);
    fetchMock.mockRestore();
  });
});
