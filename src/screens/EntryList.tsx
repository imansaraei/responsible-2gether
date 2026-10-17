import type { MemberId, MoneyEntry } from '../domain/types';
import { BANK_LABEL, formatGBP } from '../domain/money';

const dayLabel = (day: string) =>
  new Date(day + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Entries grouped by day, newest first. Only the viewer's own entries from today get a delete button. */
export function EntryList({ entries, today, me, empty, describe, onDelete }: {
  entries: MoneyEntry[]; today: string; me: MemberId; empty: string;
  describe?(e: MoneyEntry): string; onDelete(id: string): void;
}) {
  if (entries.length === 0) return <p className="muted">{empty}</p>;
  const days = [...new Set(entries.map((e) => e.day))].sort().reverse();
  return (
    <>
      {days.map((day) => (
        <section key={day}>
          <h3 className="entry-day">{dayLabel(day)}</h3>
          <ul className="cards">
            {entries.filter((e) => e.day === day).sort((x, y) => y.createdAt - x.createdAt).map((e) => {
              const name = e.kind === 'nothing' ? 'No spending ✓' : e.kind === 'bank' ? BANK_LABEL : (e.label || 'Purchase');
              const shown = e.kind === 'bank' ? `+${formatGBP(e.amount)}` : formatGBP(e.amount);
              return (
                <li key={e.id} className="card entry-row">
                  <span className="entry-label">{describe ? describe(e) : name}</span>
                  {!describe && e.kind !== 'nothing' && <span className={`entry-amount${e.kind === 'bank' ? ' in' : ''}`}>{shown}</span>}
                  {e.by === me && e.day === today && (
                    <button className="btn ghost small" aria-label={`Delete ${name} ${shown}`} onClick={() => onDelete(e.id)}>Delete</button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
