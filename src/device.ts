import type { MemberId } from './domain/types';

export interface DeviceState {
  code: string | null;
  me: MemberId | null;
  lastExportAt: number | null;
}

export const EMPTY_DEVICE: DeviceState = { code: null, me: null, lastExportAt: null };
const KEY = 'r2g.device';
const DAY = 86_400_000;

export function loadDevice(storage?: Storage): DeviceState {
  try {
    const s = storage ?? localStorage;
    const raw = s.getItem(KEY);
    if (!raw) return EMPTY_DEVICE;
    const p = JSON.parse(raw);
    return {
      code: typeof p.code === 'string' ? p.code : null,
      me: p.me === 'a' || p.me === 'b' ? p.me : null,
      lastExportAt: typeof p.lastExportAt === 'number' ? p.lastExportAt : null,
    };
  } catch {
    return EMPTY_DEVICE;
  }
}

export function saveDevice(s: DeviceState, storage?: Storage): void {
  try {
    const st = storage ?? localStorage;
    st.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage blocked (private mode); identity lasts for this session only.
  }
}

export const exportReminderDue = (lastExportAt: number | null, now: number) =>
  lastExportAt === null || now - lastExportAt > 30 * DAY;
