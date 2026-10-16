import { useHousehold } from '../state/HouseholdContext';
import { useWeek } from '../firebase/hooks';
import { summarizeWeek } from '../domain/weekSummary';
import { other } from '../domain/types';
import { exportReminderDue } from '../device';
import { memberColor } from '../components/colors';
import type { NavTarget } from '../navigation';

export function Home({ onNavigate }: { onNavigate(t: NavTarget): void }) {
  const { code, me, members, chores, currentWeekId, device } = useHousehold();
  const { completions, feedback, logs, loading } = useWeek(code, currentWeekId);
  const partner = other(me);

  const { pct, done } = summarizeWeek(currentWeekId, chores, completions, logs, true);
  const toActOn = feedback.filter((f) => f.kind === 'minus' && f.to === me && !f.resolved).length;
  const split = `You ${pct[me]}% · ${members[partner].name} ${pct[partner]}%`;

  return (
    <main className="page home">
      <header className="home-head">
        <h1>Khooneh</h1>
        <p className="muted">Hi {members[me].name}</p>
      </header>

      {!loading && toActOn > 0 && (
        <button className="notice notice-action" onClick={() => onNavigate({ tab: 'chores', section: 'todo' })}>
          {toActOn} feedback note{toActOn === 1 ? '' : 's'} to act on ›
        </button>
      )}
      {exportReminderDue(device.lastExportAt, Date.now()) && (
        <button className="notice notice-action" onClick={() => onNavigate({ tab: 'settings' })}>
          Back up your data ›
        </button>
      )}

      <div className="home-actions">
        <button className="btn primary big" onClick={() => onNavigate({ tab: 'chores', section: 'todo' })}>
          ＋ Chore
        </button>
      </div>

      <button className="card module-card" onClick={() => onNavigate({ tab: 'chores', section: 'week' })}>
        <span className="module-card-title">🧺 Tidy Together <span aria-hidden="true">›</span></span>
        {loading ? (
          <span className="muted">Loading…</span>
        ) : done.total === 0 ? (
          <span className="muted">Nothing logged yet this week</span>
        ) : (
          <>
            <span>{split}</span>
            <span className="split-bar" aria-hidden="true">
              <span style={{ width: `${pct[me]}%`, background: memberColor(me) }} />
              <span style={{ width: `${pct[partner]}%`, background: memberColor(partner) }} />
            </span>
          </>
        )}
      </button>

      <button className="card module-card" onClick={() => onNavigate({ tab: 'money' })}>
        <span className="module-card-title">👛 Pocket Money <span aria-hidden="true">›</span></span>
        <span className="muted">Coming soon: allowances, purchases and your Piggy Bank.</span>
      </button>
    </main>
  );
}
