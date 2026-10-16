import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useHousehold } from '../state/HouseholdContext';
import { usePocketMoney } from '../state/PocketMoneyContext';
import { addMoneyEntry } from '../firebase/repo';
import { allowanceStatus, formatGBP, MAX_LABEL, parseAmount } from '../domain/money';

export type PurchaseSource = 'mine' | 'home';

export function PurchaseSheet({ open, source = 'mine', onClose, onSaved }: {
  open: boolean; source?: PurchaseSource; onClose(): void; onSaved(message: string): void;
}) {
  const { code, me } = useHousehold();
  const { today, entries, budgetFor } = usePocketMoney();
  const [amountText, setAmountText] = useState('');
  const [label, setLabel] = useState('');
  const [from, setFrom] = useState<PurchaseSource>(source);
  const amountRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const amountId = useId();

  useEffect(() => {
    if (!open) return;
    setAmountText(''); setLabel(''); setFrom(source);
    requestAnimationFrame(() => amountRef.current?.focus());
  }, [open, source]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const budget = budgetFor(from === 'home' ? 'shared' : me);
  const amount = parseAmount(amountText);
  const recent = [...new Set(entries.filter((e) => e.by === me && e.label && e.kind === 'purchase')
    .sort((a, b) => b.createdAt - a.createdAt).map((e) => e.label))].slice(0, 5);

  const preview = (pence: number) => {
    if (!budget) return '';
    const s = allowanceStatus(budget, entries, today);
    return from === 'home'
      ? `${formatGBP(s.monthLeft - pence)} left in Home this month`
      : `${formatGBP(s.todayLeft - pence)} left today`;
  };

  function save(e: FormEvent) {
    e.preventDefault();
    if (amount === null || !budget) return;
    void addMoneyEntry(code, { budgetId: budget.id, by: me, day: today, amount, label, kind: 'purchase' }, crypto.randomUUID());
    onSaved(`${formatGBP(amount)} — ${preview(amount)}`);
    onClose();
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h2 id={titleId}>New purchase</h2>
        <label htmlFor={amountId}>Amount</label>
        <span className="amount-field"><span aria-hidden="true">£</span><input id={amountId} ref={amountRef} inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} placeholder="0.00" /></span>
        {amountText.trim() !== '' && amount === null && <p className="error small">Enter an amount like 4.50</p>}
        <label>What was it?
          <input value={label} maxLength={MAX_LABEL} onChange={(e) => setLabel(e.target.value)} placeholder="Optional" />
        </label>
        {recent.length > 0 && (
          <div className="chips">
            {recent.map((r) => <button type="button" key={r} className="chip" onClick={() => setLabel(r)}>{r}</button>)}
          </div>
        )}
        <div className="kind-toggle" role="radiogroup" aria-label="Pay from">
          <button type="button" role="radio" aria-checked={from === 'mine'} className={from === 'mine' ? 'on plus' : ''} onClick={() => setFrom('mine')}>My allowance</button>
          <button type="button" role="radio" aria-checked={from === 'home'} className={from === 'home' ? 'on plus' : ''} onClick={() => setFrom('home')}>Home pot</button>
        </div>
        {amount !== null && budget && <p className="muted">After this: {preview(amount)}</p>}
        <div className="sheet-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={amount === null || !budget}>Save</button>
        </div>
      </form>
    </div>
  );
}
