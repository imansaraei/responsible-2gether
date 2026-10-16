import { useEffect, useState } from 'react';
import { useHousehold } from '../state/HouseholdContext';
import { useWeek } from '../firebase/hooks';
import { helpfulness } from '../domain/scoring';
import { summarizeWeek } from '../domain/weekSummary';
import { formatMinutes } from '../domain/blocks';
import { formatWeekRange, shiftWeek } from '../domain/week';
import { other } from '../domain/types';
import { Donut } from '../components/Donut';
import { HelpBar } from '../components/HelpBar';
import { memberColor, sliceColor } from '../components/colors';

export function Dashboard() {
  const { code, me, members, chores, currentWeekId } = useHousehold();
  const [weekId, setWeekId] = useState(currentWeekId);
  useEffect(() => setWeekId(currentWeekId), [currentWeekId]);
  const isCurrent = weekId === currentWeekId;
  const { completions, feedback, logs } = useWeek(code, weekId);

  const summary = summarizeWeek(weekId, chores, completions, logs, isCurrent);
  const { slices, pct, done, planned, mode } = summary;
  const order = [me, other(me)] as const;
  const kindWords = feedback.filter((f) => f.kind === 'plus' && f.to === me);

  return (
    <main className="page">
      <div className="weeknav">
        <button className="btn ghost" aria-label="Previous week" onClick={() => setWeekId(shiftWeek(weekId, -1))}>‹</button>
        <div><strong>{isCurrent ? 'This week' : weekId}</strong><div className="muted small">{formatWeekRange(weekId)}</div></div>
        <button className="btn ghost" aria-label="Next week" disabled={isCurrent} onClick={() => setWeekId(shiftWeek(weekId, 1))}>›</button>
      </div>

      {mode === 'legacy' && (
        <p className="muted small">Rated with percentages (before time blocks) — shown as estimated minutes.</p>
      )}

      <Donut
        slices={slices}
        ariaLabel={`Chores done, ${formatWeekRange(weekId)}: ${members[order[0]].name} ${pct[order[0]]}%, ${members[order[1]].name} ${pct[order[1]]}%, ${formatMinutes(done.total)}`}
        label={done.total === 0
          ? <span className="muted">Nothing logged yet</span>
          : mode === 'blocks'
            ? <><strong>{formatMinutes(done.total)}</strong><span className="muted small">logged this week</span></>
            : <><strong>{formatMinutes(done.total)}</strong><span className="muted small">of {formatMinutes(planned ?? 0)}</span></>}
      />

      <div className="legend">
        {order.map((m) => (
          <div key={m} className="legend-col">
            <div className="legend-head">
              <span className="dot" style={{ background: memberColor(m) }} />
              <span>{members[m].name}</span>
              <strong data-testid={`share-${m}`}>{pct[m]}%</strong>
            </div>
            <ul>
              {slices.filter((s) => s.member === m).map((s) => (
                <li key={s.key}>
                  <span className="dot small" style={{ background: sliceColor(s.member, s.shadeIndex, s.shadeCount) }} />
                  {s.label} <span className="muted">{formatMinutes(s.value)}</span>
                </li>
              ))}
            </ul>
            <div className="muted small">{formatMinutes(done[m])} {mode === 'blocks' ? 'logged' : 'done'}</div>
          </div>
        ))}
      </div>

      <h2>Helpfulness</h2>
      <div className="card stack">
        {order.map((m) => <HelpBar key={m} name={members[m].name} member={m} value={helpfulness(feedback, m)} />)}
      </div>

      <h2>Kind words {isCurrent ? 'this week' : 'that week'}</h2>
      {kindWords.length === 0
        ? <p className="muted">None yet.</p>
        : <ul className="cards">{kindWords.map((f) => <li key={f.id} className="card kind">"{f.text}" <span className="muted small">— {members[f.from].name}</span></li>)}</ul>}
    </main>
  );
}
