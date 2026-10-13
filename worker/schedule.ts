// Reminders go out at 10:00 and 22:00 in each device's own time zone. The cron runs every
// 15 minutes, so a device is due when its local time falls in the first 15 minutes of
// either hour. Quarter-hour granularity covers zones like Asia/Tehran (UTC+3:30).
export const REMINDER_HOURS = [10, 22] as const;
export const CRON_INTERVAL_MINUTES = 15;

export type ReminderSlot = 'morning' | 'evening';

export function localHourMinute(now: Date, timeZone: string): { hour: number; minute: number } | null {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(now);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value);
    const minute = Number(parts.find((p) => p.type === 'minute')?.value);
    return Number.isInteger(hour) && Number.isInteger(minute) ? { hour, minute } : null;
  } catch {
    return null; // unknown time zone
  }
}

export function reminderDue(now: Date, timeZone: string): ReminderSlot | null {
  const t = localHourMinute(now, timeZone);
  if (!t || t.minute >= CRON_INTERVAL_MINUTES) return null;
  if (t.hour === REMINDER_HOURS[0]) return 'morning';
  if (t.hour === REMINDER_HOURS[1]) return 'evening';
  return null;
}

export const isValidTimeZone = (tz: unknown): tz is string =>
  typeof tz === 'string' && tz.length > 0 && tz.length <= 64 && localHourMinute(new Date(0), tz) !== null;
