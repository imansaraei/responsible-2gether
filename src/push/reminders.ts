// Daily reminder notifications (10:00 and 22:00 device-local time) via Web Push.
// The server half lives in worker/; this side asks for permission, subscribes the device
// and tells the Worker which time zone to remind it in.

// Public half of the VAPID key pair; the private half is a Cloudflare secret.
export const VAPID_PUBLIC_KEY =
  'BIf9NAqCLKdaDY5aq032eNdcndShlqEQza91s5ZIGa3l2CONqXtRN0ndsjlWeCSerWD6B9hdKnggJQVLN9Fxq6I';

export type ReminderSupport = 'supported' | 'needs-install' | 'unsupported';
export type ReminderState = 'on' | 'off' | 'blocked';

interface Platform {
  userAgent: string;
  standalone: boolean;
  hasPush: boolean;
}

export function currentPlatform(): Platform {
  const nav = navigator as Navigator & { standalone?: boolean };
  return {
    userAgent: nav.userAgent,
    standalone: nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true,
    hasPush: 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
  };
}

// iPhone/iPad only allow web push for apps added to the Home Screen.
export function reminderSupport(p: Platform = currentPlatform()): ReminderSupport {
  const isIOS = /iPhone|iPad|iPod/.test(p.userAgent);
  if (isIOS && !p.standalone) return 'needs-install';
  return p.hasPush ? 'supported' : 'unsupported';
}

export function urlBase64ToUint8Array(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

async function registerWithServer(sub: PushSubscription): Promise<void> {
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON(), timeZone: timeZone() }),
  });
  if (!res.ok) throw new Error(`subscribe failed: ${res.status}`);
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function getReminderState(): Promise<ReminderState> {
  if (Notification.permission === 'denied') return 'blocked';
  return (await currentSubscription()) ? 'on' : 'off';
}

// Must be called from a tap: iOS only shows the permission prompt in response to a user gesture.
export async function enableReminders(): Promise<ReminderState> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off';
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) }));
  await registerWithServer(sub);
  return 'on';
}

export async function disableReminders(): Promise<ReminderState> {
  const sub = await currentSubscription();
  if (sub) {
    // Tell the server first; if that fails the device still stops receiving once unsubscribed,
    // and the server forgets it after the push service reports it gone.
    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => undefined);
    await sub.unsubscribe();
  }
  return 'off';
}

// On every app start: if this device is subscribed, refresh the server's copy so a
// changed time zone (travel) or rotated subscription takes effect.
export async function syncReminders(): Promise<void> {
  if (reminderSupport() !== 'supported' || Notification.permission !== 'granted') return;
  const sub = await currentSubscription();
  if (sub) await registerWithServer(sub);
}
