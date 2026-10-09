import { useState, type FormEvent } from 'react';
import { useHousehold } from '../state/HouseholdContext';
import { addChore, archiveChore, updateChore } from '../firebase/repo';
import { MEMBER_IDS, other, type Chore, type MemberId } from '../domain/types';
import { memberColor } from '../components/colors';

export function clampHours(n: number): number {
  if (!Number.isFinite(n)) return 0.25;
  return Math.min(40, Math.max(0.25, Math.round(n * 4) / 4));
}

const fmt = (n: number) => `${Math.round(n * 100) / 100} h`;

function ChoreRow({ chore }: { chore: Chore }) {
  const { code, members } = useHousehold();
  const [name, setName] = useState(chore.name);
  const [hours, setHours] = useState(String(chore.hours));

  const commitName = () => {
    const n = name.trim().slice(0, 60);
    if (!n) return setName(chore.name);
    if (n !== chore.name) void updateChore(code, chore.id, { name: n });
  };
  const commitHours = () => {
    const h = clampHours(parseFloat(hours));
    setHours(String(h));
    if (h !== chore.hours) void updateChore(code, chore.id, { hours: h });
  };

  return (
    <li className="card chore-row">
      <input className="chore-name" aria-label="Chore name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} onBlur={commitName} />
      <input className="chore-hours" aria-label={`${chore.name} hours per week`} type="number" inputMode="decimal" step={0.25} min={0.25} max={40}
        value={hours} onChange={(e) => setHours(e.target.value)} onBlur={commitHours} />
      <button className="btn assignee" style={{ borderColor: memberColor(chore.assignee) }}
        onClick={() => void updateChore(code, chore.id, { assignee: other(chore.assignee) })}>
        {members[chore.assignee].name}
      </button>
      <button className="btn ghost small" aria-label={`Remove ${chore.name}`}
        onClick={() => { if (confirm(`Remove “${chore.name}”? Past weeks keep it.`)) void archiveChore(code, chore.id); }}>✕</button>
    </li>
  );
}

export function Config() {
  const { code, me, members, chores } = useHousehold();
  const active = chores.filter((c) => c.archivedAt === null).sort((a, b) => a.createdAt - b.createdAt);
  const total = (m: MemberId) => active.filter((c) => c.assignee === m).reduce((s, c) => s + c.hours, 0);
  const [name, setName] = useState('');
  const [hours, setHours] = useState('1');
  const [assignee, setAssignee] = useState<MemberId>(me);

  function add(e: FormEvent) {
    e.preventDefault();
    const n = name.trim().slice(0, 60);
    if (!n) return;
    void addChore(code, { name: n, hours: clampHours(parseFloat(hours)), assignee });
    setName(''); setHours('1');
  }

  return (
    <main className="page">
      <h1>Chores setup</h1>
      <div className="totals">
        {MEMBER_IDS.map((m) => (
          <div key={m} className="card total">
            <span className="dot" style={{ background: memberColor(m) }} /> {members[m].name}
            <strong data-testid={`total-${m}`}>{fmt(total(m))}</strong>
          </div>
        ))}
      </div>
      <p className="muted small">Hours per week · tap a name to reassign.</p>
      <ul className="cards">{active.map((c) => <ChoreRow key={c.id} chore={c} />)}</ul>

      <h2>Add a chore</h2>
      <form className="card stack" onSubmit={add}>
        <label>New chore<input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Vacuum the flat" /></label>
        <label>Hours per week<input type="number" inputMode="decimal" step={0.25} min={0.25} max={40} value={hours} onChange={(e) => setHours(e.target.value)} /></label>
        <div className="kind-toggle" role="radiogroup" aria-label="Assignee">
          {MEMBER_IDS.map((m) => (
            <button type="button" key={m} role="radio" aria-checked={assignee === m} className={assignee === m ? 'on plus' : ''} onClick={() => setAssignee(m)}>{members[m].name}</button>
          ))}
        </div>
        <button className="btn primary" disabled={!name.trim()}>Add chore</button>
      </form>
    </main>
  );
}
