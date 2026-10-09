import { useHousehold } from '../state/HouseholdContext';
import { useWeek } from '../firebase/hooks';
import { setCompletion, setFeedbackResolved } from '../firebase/repo';
import { choresForWeek } from '../domain/scoring';
import { other } from '../domain/types';
import { SegmentedPercent } from '../components/SegmentedPercent';

const when = (ms: number) => new Date(ms).toLocaleDateString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });

export function Todo() {
  const { code, me, members, chores, currentWeekId } = useHousehold();
  const { completions, feedback } = useWeek(code, currentWeekId);
  const mine = choresForWeek(currentWeekId, chores, completions, true).filter((v) => v.assignee === me && chores.find((c) => c.id === v.choreId)?.archivedAt === null);
  const tasks = feedback.filter((f) => f.kind === 'minus' && f.to === me);

  return (
    <main className="page">
      <h1>To-do</h1>
      <h2>Your chores <span className="muted small">% done this week</span></h2>
      {mine.length === 0 ? <p className="muted">No chores assigned to you.</p> : (
        <ul className="cards">
          {mine.map((v) => (
            <li key={v.choreId} className="card todo-row">
              <div className="todo-head"><span>{v.name}</span><span className="muted small">{v.hours} h/wk</span></div>
              <SegmentedPercent label={v.name} value={v.percent} onChange={(p) => void setCompletion(code, currentWeekId, v, p)} />
            </li>
          ))}
        </ul>
      )}

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
