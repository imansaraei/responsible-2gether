import { useEffect, useState } from 'react';
import { useHousehold } from '../state/HouseholdContext';
import { useWeek } from '../firebase/hooks';
import { choresForWeek, donutSlices, helpfulness, memberHours, sharePercents } from '../domain/scoring';
import { formatWeekRange, shiftWeek } from '../domain/week';
import { other } from '../domain/types';
import { exportReminderDue } from '../device';
import { Donut } from '../components/Donut';
import { HelpBar } from '../components/HelpBar';
import { memberColor, sliceColor } from '../components/colors';

const h = (n: number) => `${Math.round(n * 10) / 10} h`;

export function Dashboard() {
  const { code, me, members, chores, currentWeekId, device } = useHousehold();
  const [weekId, setWeekId] = useState(currentWeekId);
  useEffect(() => setWeekId(currentWeekId), [currentWeekId]);
  const isCurrent = weekId === currentWeekId;
  const { completions, feedback } = useWeek(code, weekId);

  const views = choresForWeek(weekId, chores, completions, isCurrent);
  const slices = donutSlices(views);
  const pct = sharePercents(views);
  const hours = memberHours(views);
  const order = [me, other(me)] as const;
  const kindWords = feedback.filter((f) => f.kind === 'plus' && f.to === me);

  return (
    <main className="page">
      {exportReminderDue(device.lastExportAt, Date.now()) && (
        <p className="notice">Back up your data: Settings › Export.</p>
      )}
      <div className="weeknav">
        <button className="btn ghost" aria-label="Previous week" onClick={() => setWeekId(shiftWeek(weekId, -1))}>‹</button>
        <div><strong>{isCurrent ? 'This week' : weekId}</strong><div className="muted small">{formatWeekRange(weekId)}</div></div>
        <button className="btn ghost" aria-label="Next week" disabled={isCurrent} onClick={() => setWeekId(shiftWeek(weekId, 1))}>›</button>
      </div>

      <Donut
        slices={slices}
        ariaLabel={`Chores done, ${formatWeekRange(weekId)}: ${members[order[0]].name} ${pct[order[0]]}%, ${members[order[1]].name} ${pct[order[1]]}%, ${h(hours.done)} of ${h(hours.total)}`}
        label={hours.done === 0
          ? <span className="muted">Nothing done yet</span>
          : <><strong>{h(hours.done)}</strong><span className="muted small">of {h(hours.total)}</span></>}
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
                  {s.label} <span className="muted">{h(s.value)}</span>
                </li>
              ))}
            </ul>
            <div className="muted small">{h(hours[m])} done of {h(views.filter((v) => v.assignee === m).reduce((s, v) => s + v.hours, 0))}</div>
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
