import {
  disableReminders, enableReminders, getReminderState, reminderSupport, syncReminders,
  urlBase64ToUint8Array, VAPID_PUBLIC_KEY,
} from './reminders';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/141.0 Mobile Safari/537.36';

describe('reminderSupport', () => {
  test('iPhone in Safari must be installed to the Home Screen first', () => {
    expect(reminderSupport({ userAgent: IPHONE, standalone: false, hasPush: false })).toBe('needs-install');
  });
  test('installed iPhone app with push is supported', () => {
    expect(reminderSupport({ userAgent: IPHONE, standalone: true, hasPush: true })).toBe('supported');
  });
  test('Android Chrome is supported even in a tab', () => {
    expect(reminderSupport({ userAgent: ANDROID, standalone: false, hasPush: true })).toBe('supported');
  });
  test('no push APIs → unsupported', () => {
    expect(reminderSupport({ userAgent: ANDROID, standalone: true, hasPush: false })).toBe('unsupported');
  });
});

test('urlBase64ToUint8Array decodes the VAPID key to a 65-byte uncompressed P-256 point', () => {
  const bytes = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
  expect(bytes).toHaveLength(65);
  expect(bytes[0]).toBe(0x04);
});

describe('enable / disable / sync', () => {
  const subJSON = { endpoint: 'https://web.push.apple.com/abc', keys: { p256dh: 'p', auth: 'a' } };
  let existing: { endpoint: string; toJSON: () => unknown; unsubscribe: ReturnType<typeof vi.fn> } | null;
  let pushManager: { getSubscription: ReturnType<typeof vi.fn>; subscribe: ReturnType<typeof vi.fn> };
  let fetchMock: ReturnType<typeof vi.fn>;
  let permission: NotificationPermission;

  const makeSub = () => ({ endpoint: subJSON.endpoint, toJSON: () => subJSON, unsubscribe: vi.fn(async () => true) });

  beforeEach(() => {
    existing = null;
    permission = 'default';
    pushManager = {
      getSubscription: vi.fn(async () => existing),
      subscribe: vi.fn(async () => (existing = makeSub())),
    };
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve({ pushManager }) } });
    vi.stubGlobal('PushManager', function PushManager() {});
    vi.stubGlobal('Notification', {
      get permission() { return permission; },
      requestPermission: vi.fn(async () => (permission = 'granted')),
    });
    fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  test('enabling asks permission, subscribes with the VAPID key and registers the time zone', async () => {
    expect(await enableReminders()).toBe('on');
    expect(pushManager.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/push/subscribe');
    const body = JSON.parse(init.body as string);
    expect(body.subscription).toEqual(subJSON);
    expect(body.timeZone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(await getReminderState()).toBe('on');
  });

  test('denied permission reports blocked and never subscribes', async () => {
    (Notification.requestPermission as ReturnType<typeof vi.fn>).mockImplementation(async () => (permission = 'denied'));
    expect(await enableReminders()).toBe('blocked');
    expect(pushManager.subscribe).not.toHaveBeenCalled();
    expect(await getReminderState()).toBe('blocked');
  });

  test('a server error surfaces so the UI can say it failed', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    await expect(enableReminders()).rejects.toThrow(/subscribe failed/);
  });

  test('disabling tells the server and unsubscribes the device', async () => {
    existing = makeSub();
    const sub = existing;
    expect(await disableReminders()).toBe('off');
    expect(fetchMock).toHaveBeenCalledWith('/api/push/unsubscribe', expect.objectContaining({ body: JSON.stringify({ endpoint: subJSON.endpoint }) }));
    expect(sub.unsubscribe).toHaveBeenCalled();
  });

  test('sync re-registers an existing subscription and does nothing otherwise', async () => {
    permission = 'granted';
    await syncReminders();
    expect(fetchMock).not.toHaveBeenCalled();
    existing = makeSub();
    await syncReminders();
    expect(fetchMock).toHaveBeenCalledWith('/api/push/subscribe', expect.anything());
  });
});
