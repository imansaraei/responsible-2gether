import type { Chore, ChoreLog, MemberId } from './types';

// Typical minutes per occurrence for a 50 m² one-bedroom flat (spec §5.2).
export const DEFAULT_BLOCK_MINUTES: Record<string, number> = {
  'Empty dishes': 10,
  'Load the dishwasher': 15,
  'Load the washing machine': 10,
  'Empty the washing machine': 15,
  'Washing the toilet': 20,
  'Tidy up living room': 15,
  'Tidy up kitchen': 15,
  'Sorting out the groceries': 15,
  'Drying up the toilet': 5,
  'Tidy up the bedroom': 15,
  'Tidy up the hallway': 10,
  'Taking out the trash': 5,
  'Cleaning the fridge': 20,
  'Cooking': 45,
};
export const FALLBACK_BLOCK_MINUTES = 15;
export const MIN_BLOCK_MINUTES = 5;
export const MAX_BLOCK_MINUTES = 240;

export const blockMinutesOf = (c: Pick<Chore, 'name' | 'blockMinutes'>): number =>
  c.blockMinutes ?? (Object.hasOwn(DEFAULT_BLOCK_MINUTES, c.name) ? DEFAULT_BLOCK_MINUTES[c.name] : FALLBACK_BLOCK_MINUTES);

export function clampBlockMinutes(n: number): number {
  if (!Number.isFinite(n)) return MIN_BLOCK_MINUTES;
  return Math.min(MAX_BLOCK_MINUTES, Math.max(MIN_BLOCK_MINUTES, Math.round(n / 5) * 5));
}

export function parseBlockMinutes(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isNaN(n) ? null : clampBlockMinutes(n);
}

// Chores still carry the legacy weekly `hours` (required by rules and used by old weeks).
// New chores get an estimate: the block done once a day, on the quarter hour, within 0.25–40.
export const legacyHoursFor = (blockMinutes: number): number =>
  Math.min(40, Math.max(0.25, Math.round(((blockMinutes * 7) / 60) * 4) / 4));

export function formatMinutes(m: number): string {
  const mins = Math.round(m);
  const h = Math.floor(mins / 60);
  const r = mins % 60;
  if (h === 0) return `${r} m`;
  return r === 0 ? `${h} h` : `${h} h ${r} m`;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const todayKey = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const todayCount = (logs: ChoreLog[], choreId: string, by: MemberId, day: string): number =>
  logs.filter((l) => l.choreId === choreId && l.by === by && l.day === day).length;
