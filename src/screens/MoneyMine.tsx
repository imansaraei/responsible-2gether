import { useState } from 'react';
import { useHousehold } from '../state/HouseholdContext';
import { usePocketMoney } from '../state/PocketMoneyContext';
import { addMoneyEntry, deleteMoneyEntry } from '../firebase/repo';
import { allowanceStatus, formatGBP, weekDaysInMonth } from '../domain/money';
import { PurchaseSheet } from '../components/PurchaseSheet';
import { Toast, useToast } from '../components/Toast';
import { EntryList } from './EntryList';

export function MoneyMine() {
  const { code, me } = useHousehold();
  const { today, entries, budgetFor } = usePocketMoney();
  const [sheet, setSheet] = useState(false);
  const { toast, show } = useToast();
  const [error, setError] = useState<string | null>(null);
  const budget = budgetFor(me);
  if (!budget) return null;

  const s = allowanceStatus(budget, entries, today);
  const week = new Set(weekDaysInMonth(today));
  const mine = entries.filter((e) => e.budgetId === budget.id && e.by === me && week.has(e.day));

  const tiles = [
    { cap: 'Today', left: s.todayLeft, of: s.daily },
    { cap: 'This week', left: s.weekLeft, of: s.weekAllowance },
    { cap: 'This month', left: s.monthLeft, of: s.monthAllowance },
  ];

  return (
    <main className="page">
      <div className="money-tiles">
        {tiles.map((t) => (
          <div key={t.cap} className="money-tile">
            <span className="cap">{t.cap}</span>
            <span className={`big${t.left < 0 ? ' over' : ''}`}>{formatGBP(t.left)}</span>
            <span className="muted small">of {formatGBP(t.of)}</span>
          </div>
        ))}
      </div>
      <div className="home-actions">
        <button className="btn primary big" onClick={() => setSheet(true)}>＋ Purchase</button>
        {!s.loggedToday && (
          <button className="btn ghost" onClick={() => {
            setError(null);
            void addMoneyEntry(code, { budgetId: budget.id, by: me, day: today, amount: 0, label: '', kind: 'nothing' }, crypto.randomUUID())
              .catch((err) => { console.error(err); setError('Couldn’t log that. Try again.'); });
          }}>No spending today</button>
        )}
      </div>
      <h2>This week</h2>
      {error && <p className="error small" role="alert">{error}</p>}
      <EntryList
        entries={mine} today={today} me={me} empty="Nothing logged this week yet."
        onDelete={(id) => deleteMoneyEntry(code, id).catch(() => setError('Couldn’t delete this entry — try again.'))}
      />
      <PurchaseSheet open={sheet} source="mine" onClose={() => setSheet(false)} onSaved={show} />
      <Toast text={toast} />
    </main>
  );
}
