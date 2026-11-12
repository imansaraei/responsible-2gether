import { useState, type ReactNode } from 'react';
import { useHousehold } from '../state/HouseholdContext';
import { usePocketMoney } from '../state/PocketMoneyContext';
import { addMission, approveMission, setMissionStatus } from '../firebase/repo';
import { dayKeyIn, formatGBP, monthKeyOf } from '../domain/money';
import { other, type Mission } from '../domain/types';
import { NameAmountSheet } from '../components/NameAmountSheet';
import { Toast, useToast } from '../components/Toast';

const STATUS_TEXT: Record<Mission['status'], string> = { open: 'Open', done: 'Done — waiting for approval', approved: 'Approved', cancelled: 'Cancelled' };

/** Missions: one person sets the other a task with a gift; the giver approves it and the gift moves between allowances. */
export function MoneyMissions() {
  const { code, me, members } = useHousehold();
  const { today, timeZone, missions } = usePocketMoney();
  const [sheet, setSheet] = useState(false);
  const { toast, show } = useToast();
  const partner = other(me);
  const live = (m: Mission) => m.status === 'open' || m.status === 'done';
  const forMe = missions.filter((m) => m.to === me && live(m));
  const iSet = missions.filter((m) => m.from === me && live(m));
  const history = missions.filter((m) => !live(m) && monthKeyOf(dayKeyIn(new Date(m.updatedAt), timeZone)) === monthKeyOf(today));
  const write = (p: Promise<unknown>) => { void p.catch(console.error); };

  const row = (m: Mission, actions: ReactNode, who: string) => (
    <li key={m.id} className="card mission-row">
      <span className="mission-title"><strong>{m.title}</strong><span className="muted small">{who} · {STATUS_TEXT[m.status]}</span></span>
      <span className="entry-amount">🎁 {formatGBP(m.gift)}</span>
      {actions && <span className="mission-actions">{actions}</span>}
    </li>
  );

  return (
    <main className="page">
      <button className="btn primary big" onClick={() => setSheet(true)}>＋ Mission</button>
      <h2>For me</h2>
      {forMe.length === 0 ? <p className="muted">No missions for you.</p> : (
        <ul className="cards">
          {forMe.map((m) => row(m, m.status === 'open' && (
            <button className="btn" aria-label={`Mark ${m.title} done`} onClick={() => { write(setMissionStatus(code, m.id, 'done')); show(`${members[m.from].name} will be asked to approve`); }}>Mark done</button>
          ), `From ${members[m.from].name}`))}
        </ul>
      )}
      <h2>I set</h2>
      {iSet.length === 0 ? <p className="muted">You haven’t set any missions.</p> : (
        <ul className="cards">
          {iSet.map((m) => row(m, m.status === 'done' ? (
            <>
              <button className="btn primary" aria-label={`Approve ${m.title} ${formatGBP(m.gift)}`} onClick={() => { write(approveMission(code, m, today)); show(`${formatGBP(m.gift)} sent to ${members[m.to].name}`); }}>Approve {formatGBP(m.gift)}</button>
              <button className="btn ghost" aria-label={`Not yet: ${m.title}`} onClick={() => write(setMissionStatus(code, m.id, 'open'))}>Not yet</button>
            </>
          ) : (
            <button className="btn ghost" aria-label={`Cancel ${m.title}`} onClick={() => write(setMissionStatus(code, m.id, 'cancelled'))}>Cancel</button>
          ), `For ${members[m.to].name}`))}
        </ul>
      )}
      {history.length > 0 && (
        <>
          <h2>History</h2>
          <ul className="cards">{history.map((m) => row(m, null, m.from === me ? `For ${members[m.to].name}` : `From ${members[m.from].name}`))}</ul>
        </>
      )}
      <NameAmountSheet
        open={sheet} title="New mission" nameLabel="Mission" amountLabel="Gift" maxName={60} submit="Set mission"
        onClose={() => setSheet(false)}
        onSubmit={(title, gift) => { write(addMission(code, { from: me, title, gift })); show(`Mission set for ${members[partner].name}`); }}
      >
        <p className="muted">For {members[partner].name}. The gift moves from your allowance to theirs when you approve it.</p>
      </NameAmountSheet>
      <Toast text={toast} />
    </main>
  );
}
