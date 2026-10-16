import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useHousehold } from '../state/HouseholdContext';
import { addChore, archiveChore, updateChore } from '../firebase/repo';
import { MEMBER_IDS, other, type Chore, type MemberId } from '../domain/types';
import { blockMinutesOf, parseBlockMinutes } from '../domain/blocks';
import { memberColor } from '../components/colors';

const blurOnEnter = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') e.currentTarget.blur(); };

function ChoreRow({ chore, index }: { chore: Chore; index: number }) {
  const { code, members } = useHousehold();
  const [name, setName] = useState(chore.name);
  const [block, setBlock] = useState(String(blockMinutesOf(chore)));
  const [nameDirty, setNameDirty] = useState(false);
  const [blockDirty, setBlockDirty] = useState(false);

  useEffect(() => { if (!nameDirty) setName(chore.name); }, [chore.name, nameDirty]);
  const blockNow = blockMinutesOf(chore);
  // Resync only when the stored value changes, so a just-committed edit isn't reverted while the write is in flight.
  const blockDirtyRef = useRef(blockDirty);
  blockDirtyRef.current = blockDirty;
  useEffect(() => { if (!blockDirtyRef.current) setBlock(String(blockNow)); }, [blockNow]);

  const commitName = () => {
    if (!nameDirty) return;
    setNameDirty(false);
    const n = name.trim().slice(0, 60);
    if (!n) return setName(chore.name);
    if (n !== chore.name) void updateChore(code, chore.id, { name: n });
  };
  const commitBlock = () => {
    if (!blockDirty) return;
    setBlockDirty(false);
    const m = parseBlockMinutes(block);
    if (m === null) return setBlock(String(blockNow));
    setBlock(String(m));
    if (m !== blockNow) void updateChore(code, chore.id, { blockMinutes: m });
  };

  return (
    <li className="card chore-row">
      <input className="chore-name" aria-label={chore.name ? `Name of ${chore.name}` : `Name of chore ${index + 1}`} value={name} maxLength={60} onChange={(e) => { setName(e.target.value); setNameDirty(true); }} onBlur={commitName} onKeyDown={blurOnEnter} />
      <span className="chore-block">
        <input className="chore-hours" aria-label={chore.name ? `Minutes per time for ${chore.name}` : `Minutes per time for chore ${index + 1}`} type="text" inputMode="numeric"
          value={block} onChange={(e) => { setBlock(e.target.value); setBlockDirty(true); }} onBlur={commitBlock} onKeyDown={blurOnEnter} />
        <span className="muted small chore-unit">min</span>
      </span>
      <button className="btn assignee" aria-label={`Assigned to ${members[chore.assignee].name}, tap to reassign`} style={{ borderColor: memberColor(chore.assignee) }}
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
  const count = (m: MemberId) => active.filter((c) => c.assignee === m).length;
  const [name, setName] = useState('');
  const [hours, setHours] = useState('15');
  const [hoursError, setHoursError] = useState(false);
  const [assignee, setAssignee] = useState<MemberId>(me);

  function add(e: FormEvent) {
    e.preventDefault();
    const n = name.trim().slice(0, 60);
    if (!n) return;
    const m = parseBlockMinutes(hours);
    if (m === null) return setHoursError(true);
    void addChore(code, { name: n, blockMinutes: m, assignee });
    setName(''); setHours('15'); setHoursError(false);
  }

  return (
    <main className="page">
      <h1>Chores setup</h1>
      <div className="totals">
        {MEMBER_IDS.map((m) => (
          <div key={m} className="card total">
            <span className="dot" style={{ background: memberColor(m) }} /> {members[m].name}
            <strong data-testid={`total-${m}`}>{count(m)} chore{count(m) === 1 ? '' : 's'}</strong>
          </div>
        ))}
      </div>
      <p className="muted small">Minutes each time it’s done · tap a name to reassign.</p>
      <ul className="cards">{active.map((c, i) => <ChoreRow key={c.id} chore={c} index={i} />)}</ul>

      <h2>Add a chore</h2>
      <form className="card stack" onSubmit={add}>
        <label>New chore<input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Vacuum the flat" /></label>
        <label>Minutes per time<input type="text" inputMode="numeric" value={hours} onChange={(e) => { setHours(e.target.value); setHoursError(false); }} /></label>
        {hoursError && <p className="error small" role="alert">Enter minutes, e.g. 15</p>}
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
