const DAY = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const mondayIndex = (date: Date) => (date.getDay() + 6) % 7; // Mon=0 … Sun=6

function week1Monday(isoYear: number): Date {
  const jan4 = new Date(isoYear, 0, 4);
  return new Date(isoYear, 0, 4 - mondayIndex(jan4));
}

export function weekIdOf(d: Date): string {
  const thursday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - mondayIndex(d) + 3);
  const isoYear = thursday.getFullYear();
  const days = Math.round((thursday.getTime() - week1Monday(isoYear).getTime()) / DAY);
  const week = Math.floor(days / 7) + 1;
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

function parse(weekId: string): { year: number; week: number } {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekId);
  if (!m) throw new Error(`Bad weekId: ${weekId}`);
  return { year: Number(m[1]), week: Number(m[2]) };
}

export function weekStart(weekId: string): Date {
  const { year, week } = parse(weekId);
  const w1 = week1Monday(year);
  return new Date(w1.getFullYear(), w1.getMonth(), w1.getDate() + (week - 1) * 7);
}

export function weekEnd(weekId: string): Date {
  const s = weekStart(weekId);
  return new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7);
}

export function shiftWeek(weekId: string, delta: number): string {
  const s = weekStart(weekId);
  return weekIdOf(new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7 * delta + 3));
}

export function formatWeekRange(weekId: string): string {
  const s = weekStart(weekId);
  const e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6);
  if (s.getMonth() === e.getMonth()) {
    return `${s.getDate()}–${e.getDate()} ${MONTHS[e.getMonth()]} ${e.getFullYear()}`;
  }
  const sYear = s.getFullYear() === e.getFullYear() ? '' : ` ${s.getFullYear()}`;
  return `${s.getDate()} ${MONTHS[s.getMonth()]}${sYear} – ${e.getDate()} ${MONTHS[e.getMonth()]} ${e.getFullYear()}`;
}
