// Cloudflare Worker for 2gether.imansaraei.com.
// - Static files (the PWA) are served by the assets binding; this script only runs for /api/*
//   (see run_worker_first in wrangler.jsonc).
// - /api/push/subscribe and /api/push/unsubscribe store or forget a device's Web Push subscription.
// - A cron every 15 minutes sends the daily reminder to devices where it is 10:00 or 22:00 locally.
import { buildPushPayload } from '@block65/webcrypto-web-push';
import { reminderDue } from './schedule';
import { parseSubscribeBody, subscriptionKey, type StoredSubscription } from './subscriptions';

export interface Env {
  ASSETS: Fetcher;
  SUBS: KVNamespace;
  VAPID_PUBLIC_KEY: string;  // base64url P-256 point; the app uses the same value to subscribe
  VAPID_PRIVATE_KEY: string; // base64url `d`, set with `wrangler secret put VAPID_PRIVATE_KEY`
  VAPID_CONTACT: string;     // mailto: or https: contact sent to push services
}

export const REMINDER_PAYLOAD = {
  title: 'کارهای امروز رو ثبت کردی؟',
  dir: 'rtl',
  lang: 'fa',
  icon: '/pwa-192x192.png',
  badge: '/pwa-64x64.png',
  tag: 'daily-reminder',
  data: { url: '/' },
};

const MAX_BODY_BYTES = 4096;

export type SendPush = (sub: StoredSubscription, env: Env) => Promise<number>;

export const sendPush: SendPush = async (sub, env) => {
  // aes128gcm (RFC 8291) + `vapid` auth (RFC 8292): the only combination Apple accepts.
  const payload = await buildPushPayload(
    // A reminder that arrives an hour late is noise, so let it expire instead.
    { data: REMINDER_PAYLOAD, options: { ttl: 3600, urgency: 'normal', topic: 'daily-reminder' } },
    { endpoint: sub.endpoint, expirationTime: null, keys: sub.keys },
    { subject: env.VAPID_CONTACT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY },
  );
  const res = await fetch(sub.endpoint, payload);
  return res.status;
};

export async function sendDueReminders(now: Date, env: Env, send: SendPush = sendPush) {
  const result = { sent: 0, removed: 0, failed: 0 };
  let cursor: string | undefined;
  do {
    const page = await env.SUBS.list<StoredSubscription>({ prefix: 'sub:', cursor });
    const due = page.keys.filter((k) => k.metadata && reminderDue(now, k.metadata.tz));
    await Promise.all(due.map(async (k) => {
      try {
        const status = await send(k.metadata!, env);
        if (status === 404 || status === 410) {
          // The browser unsubscribed or the app was removed: forget this device.
          await env.SUBS.delete(k.name);
          result.removed++;
        } else if (status >= 200 && status < 300) {
          result.sent++;
        } else {
          result.failed++;
          console.warn('push rejected', status, new URL(k.metadata!.endpoint).hostname);
        }
      } catch (e) {
        result.failed++;
        console.error('push failed', e);
      }
    }));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return result;
}

async function readJson(req: Request): Promise<unknown> {
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export async function handleApi(req: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(req.url);
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  if (pathname === '/api/push/subscribe') {
    const sub = parseSubscribeBody(await readJson(req));
    if (!sub) return new Response('Invalid subscription', { status: 400 });
    // Value is unused; everything lives in metadata so the cron needs one list() per page.
    await env.SUBS.put(await subscriptionKey(sub.endpoint), '1', { metadata: sub });
    return new Response(null, { status: 204 });
  }

  if (pathname === '/api/push/unsubscribe') {
    const body = await readJson(req);
    const endpoint = (body as { endpoint?: unknown } | undefined)?.endpoint;
    if (typeof endpoint !== 'string' || endpoint.length > 2048) return new Response('Invalid endpoint', { status: 400 });
    await env.SUBS.delete(await subscriptionKey(endpoint));
    return new Response(null, { status: 204 });
  }

  return new Response('Not found', { status: 404 });
}

export default {
  async fetch(req, env) {
    const { pathname } = new URL(req.url);
    if (pathname.startsWith('/api/')) return handleApi(req, env);
    return env.ASSETS.fetch(req);
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      sendDueReminders(new Date(controller.scheduledTime), env).then((r) => console.log('reminders', JSON.stringify(r))),
    );
  },
} satisfies ExportedHandler<Env>;
