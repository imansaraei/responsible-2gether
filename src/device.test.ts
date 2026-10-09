import { vi } from 'vitest';
import { loadDevice, saveDevice, exportReminderDue, EMPTY_DEVICE } from './device';

const memoryStorage = (): Storage => {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
};

test('empty storage gives empty device', () => {
  expect(loadDevice(memoryStorage())).toEqual(EMPTY_DEVICE);
});

test('round-trips', () => {
  const s = memoryStorage();
  saveDevice({ code: 'tidy-otter-maple-4821', me: 'b', lastExportAt: 5 }, s);
  expect(loadDevice(s)).toEqual({ code: 'tidy-otter-maple-4821', me: 'b', lastExportAt: 5 });
});

test('corrupt JSON gives empty device', () => {
  const s = memoryStorage();
  s.setItem('r2g.device', '{nope');
  expect(loadDevice(s)).toEqual(EMPTY_DEVICE);
});

test('throwing storage gives empty device and save does not throw', () => {
  const s = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } } as unknown as Storage;
  expect(loadDevice(s)).toEqual(EMPTY_DEVICE);
  expect(() => saveDevice(EMPTY_DEVICE, s)).not.toThrow();
});

test('blocked localStorage (SecurityError on access) gives empty device and save does not throw', () => {
  const mock = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
    throw new Error('SecurityError');
  });
  try {
    expect(loadDevice()).toEqual(EMPTY_DEVICE);
    expect(() => saveDevice(EMPTY_DEVICE)).not.toThrow();
  } finally {
    mock.mockRestore();
  }
});

describe('exportReminderDue', () => {
  const DAY = 86_400_000;
  test('never exported', () => expect(exportReminderDue(null, 0)).toBe(true));
  test('29 days ago', () => expect(exportReminderDue(0, 29 * DAY)).toBe(false));
  test('31 days ago', () => expect(exportReminderDue(0, 31 * DAY)).toBe(true));
});
