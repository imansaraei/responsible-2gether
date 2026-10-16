import { useHousehold } from '../state/HouseholdContext';
import { useWeek } from '../firebase/hooks';
import { setFeedbackResolved } from '../firebase/repo';
import { other } from '../domain/types';
import { ChoreLogger } from '../components/ChoreLogger';

const when = (ms: number) => new Date(ms).toLocaleDateString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });

export function Todo() {
  const { code, me, members, currentWeekId } = useHousehold();
  const { feedback, logs } = useWeek(code, currentWeekId);
  const tasks = feedback.filter((f) => f.kind === 'minus' && f.to === me);

  return (
    <main className="page">
      <h1>To-do</h1>
      <h2>Log a chore</h2>
      <ChoreLogger logs={logs} />

      <h2>Feedback to act on</h2>
      {tasks.length === 0 ? <p className="muted">Nothing from {members[other(me)].name} this week.</p> : (
        <ul className="cards">
          {tasks.map((f) => (
            <li key={f.id} className={`card check-row${f.resolved ? ' done' : ''}`}>
              <label>
                <input type="checkbox" checked={f.resolved} onChange={(e) => void setFeedbackResolved(code, currentWeekId, f.id, e.target.checked)} />
                <span>{f.text}</span>
              </label>
              <span className="muted small">{when(f.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
