// @vitest-environment node
import { isPushEndpoint, parseSubscribeBody, subscriptionKey } from './subscriptions';

const keys = { p256dh: 'B' + 'a'.repeat(86), auth: 'tBHItJI5svbpez7KI4CCXg' };
const body = (over: Record<string, unknown> = {}) => ({
  subscription: { endpoint: 'https://web.push.apple.com/QGuQyavXutnMH', keys },
  timeZone: 'Asia/Tehran',
  ...over,
});

test('accepts a well-formed subscription and keeps only the needed fields', () => {
  const extra = { ...body(), subscription: { ...body().subscription, expirationTime: null } };
  expect(parseSubscribeBody(extra)).toEqual({
    endpoint: 'https://web.push.apple.com/QGuQyavXutnMH', keys, tz: 'Asia/Tehran',
  });
});

test.each([
  ['not an object', 'nope'],
  ['missing subscription', { timeZone: 'UTC' }],
  ['bad time zone', body({ timeZone: 'Mars/Base' })],
  ['non-push host', body({ subscription: { endpoint: 'https://evil.example/x', keys } })],
  ['missing keys', body({ subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/abc' } })],
  ['bad auth key', body({ subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { ...keys, auth: 'not base64!' } } })],
  ['oversized endpoint', body({ subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/' + 'x'.repeat(1000), keys } })],
])('rejects %s', (_label, input) => {
  expect(parseSubscribeBody(input)).toBeNull();
});

test.each([
  ['https://fcm.googleapis.com/fcm/send/abc', true],
  ['https://web.push.apple.com/abc', true],
  ['https://updates.push.services.mozilla.com/wpush/v2/abc', true],
  ['https://wns2-db5p.notify.windows.com/w/?token=abc', true],
  ['http://fcm.googleapis.com/fcm/send/abc', false],
  ['https://fcm.googleapis.com:8443/fcm/send/abc', false],
  ['https://notpush.apple.com.evil.example/abc', false],
  ['not a url', false],
])('isPushEndpoint(%s) = %s', (url, ok) => {
  expect(isPushEndpoint(url)).toBe(ok);
});

test('subscriptionKey is stable and endpoint-specific', async () => {
  const a = await subscriptionKey('https://fcm.googleapis.com/fcm/send/a');
  expect(a).toMatch(/^sub:[0-9a-f]{64}$/);
  expect(await subscriptionKey('https://fcm.googleapis.com/fcm/send/a')).toBe(a);
  expect(await subscriptionKey('https://fcm.googleapis.com/fcm/send/b')).not.toBe(a);
});
