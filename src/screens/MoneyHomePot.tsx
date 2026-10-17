import { useState } from 'react';
import { useHousehold } from '../state/HouseholdContext';
import { usePocketMoney } from '../state/PocketMoneyContext';
import { deleteMoneyEntry } from '../firebase/repo';
import { allowanceStatus, formatGBP, monthKeyOf } from '../domain/money';
import { PurchaseSheet } from '../components/PurchaseSheet';
import { Toast, useToast } from '../components/Toast';
import { EntryList } from './EntryList';

export function MoneyHomePot() {
  const { code, me, members } = useHousehold();
  const { today, entries, budgetFor } = usePocketMoney();
  const [sheet, setSheet] = useState(false);
  const { toast, show } = useToast();
  const [error, setError] = useState<string | null>(null);
  const budget = budgetFor('shared');
  if (!budget) return null;
  const s = allowanceStatus(budget, entries, today);
  const month = monthKeyOf(today);
  const list = entries.filter((e) => e.budgetId === budget.id && monthKeyOf(e.day) === month);

  return (
    <main className="page">
      <div className="card stack pot-hero">
        <span className={`big${s.monthLeft < 0 ? ' over' : ''}`}>{formatGBP(s.monthLeft)} left this month</span>
        <span className="muted">of {formatGBP(s.monthAllowance)}</span>
      </div>
      <div className="home-actions">
        <button className="btn primary big" onClick={() => setSheet(true)}>＋ Home purchase</button>
      </div>
      {error && <p className="error small" role="alert">{error}</p>}
      <EntryList
        entries={list} today={today} me={me} empty="Nothing spent from the Home pot yet."
        describe={(e) => `${e.kind === 'nothing' ? 'No spending ✓' : (e.label || 'Purchase')} · ${members[e.by].name} · ${formatGBP(e.amount)}`}
        onDelete={(id) => deleteMoneyEntry(code, id).catch(() => setError('Couldn’t delete this entry — try again.'))}
      />
      <PurchaseSheet open={sheet} source="home" onClose={() => setSheet(false)} onSaved={show} />
      <Toast text={toast} />
    </main>
  );
}
