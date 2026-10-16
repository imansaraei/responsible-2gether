import { useEffect, useState } from 'react';
import { useHousehold } from '../state/HouseholdContext';
import { addLog, deleteLog } from '../firebase/repo';
import { blockMinutesOf, formatMinutes, todayCount, todayKey } from '../domain/blocks';
import { MULTIPLIERS, other, type Chore, type ChoreLog, type Multiplier } from '../domain/types';

const UNDO_MS = 10_000;

export function ChoreLogger({ logs }: { logs: ChoreLog[] }) {
  const { code, me, members, chores, currentWeekId } = useHousehold();
  const [open, setOpen] = useState<string | null>(null);
  const [multiplier, setMultiplier] = useState<Multiplier>(1);
  const [toast, setToast] = useState<{ id: string; text: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), UNDO_MS);
    return () => clearTimeout(t);
  }, [toast]);

  const day = todayKey();
  const active = chores.filter((c) => c.archivedAt === null).sort((a, b) => a.createdAt - b.createdAt);
  const groups: { title: string; items: Chore[] }[] = [
    { title: 'Yours', items: active.filter((c) => c.assignee === me) },
    { title: `${members[other(me)].name}’s`, items: active.filter((c) => c.assignee !== me) },
  ];

  function toggle(id: string) {
    setOpen((cur) => (cur === id ? null : id));
    setMultiplier(1);
  }

  function add(chore: Chore) {
    const blockMinutes = blockMinutesOf(chore);
    const id = crypto.randomUUID();
    void addLog(code, currentWeekId, { chore: { id: chore.id, name: chore.name }, by: me, multiplier, blockMinutes, day }, id);
    setToast({ id, text: `Logged ${formatMinutes(blockMinutes * multiplier)} · ${chore.name}` });
    setOpen(null);
    setMultiplier(1);
  }

  function undo() {
    if (!toast) return;
    void deleteLog(code, currentWeekId, toast.id);
    setToast(null);
  }

  return (
    <div className="logger">
      {groups.map((g) => g.items.length > 0 && (
        <section key={g.title} className="logger-group">
          <h3 className="logger-title">{g.title}</h3>
          <ul className="cards">
            {g.items.map((c) => {
              const block = blockMinutesOf(c);
              const count = todayCount(logs, c.id, me, day);
              const isOpen = open === c.id;
              return (
                <li key={c.id} className={`card logger-row${isOpen ? ' open' : ''}`}>
                  <button className="logger-head" aria-expanded={isOpen} onClick={() => toggle(c.id)}>
                    <span className="logger-name">{c.name}</span>
                    <span className="muted small">{block} min</span>
                    {count > 0 && <span className="logger-count">✓ {count} today</span>}
                  </button>
                  {isOpen && (
                    <div className="logger-body">
                      <div className="kind-toggle three" role="radiogroup" aria-label="How many times">
                        {MULTIPLIERS.map((m) => (
                          <button key={m} type="button" role="radio" aria-checked={multiplier === m}
                            className={multiplier === m ? 'on plus' : ''} onClick={() => setMultiplier(m)}>{m}×</button>
                        ))}
                      </div>
                      <div className="logger-add">
                        <span className="muted">= {block * multiplier} min</span>
                        <button className="btn primary" onClick={() => add(c)}>Add</button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {toast && (
        <div className="toast" role="status">
          <span>{toast.text}</span>
          <button className="btn ghost small" onClick={undo}>Undo</button>
        </div>
      )}
    </div>
  );
}
