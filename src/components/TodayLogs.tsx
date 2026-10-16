import { useState } from 'react';
import { useHousehold } from '../state/HouseholdContext';
import { deleteLog } from '../firebase/repo';
import { formatMinutes, todayKey } from '../domain/blocks';
import type { ChoreLog } from '../domain/types';

export function TodayLogs({ logs }: { logs: ChoreLog[] }) {
  const { code, me, currentWeekId } = useHousehold();
  const [error, setError] = useState<string | null>(null);
  const day = todayKey();
  const mine = logs.filter((l) => l.day === day && l.by === me).sort((a, b) => b.createdAt - a.createdAt);

  function remove(id: string) {
    setError(null);
    deleteLog(code, currentWeekId, id).catch(() => setError('Couldn’t delete this log — try again.'));
  }

  return (
    <>
      <h2>Logged today</h2>
      {mine.length === 0 ? <p className="muted">Nothing logged today yet.</p> : (
        <ul className="cards">
          {mine.map((l) => (
            <li key={l.id} className="card log-row">
              <span>{l.name} · {formatMinutes(l.minutes)}</span>
              <button className="btn ghost small" aria-label={`Delete ${l.name} ${formatMinutes(l.minutes)}`} onClick={() => remove(l.id)}>Delete</button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </>
  );
}
