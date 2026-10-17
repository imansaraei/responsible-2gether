import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useHousehold } from '../state/HouseholdContext';
import { usePocketMoney } from '../state/PocketMoneyContext';
import { addMoneyEntry } from '../firebase/repo';
import { allowanceStatus, BANK_LABEL, formatGBP, parseAmount, piggyBank } from '../domain/money';

/** Moves money from the viewer's own Piggy Bank into this month's personal allowance. */
export function BankSheet({ open, onClose, onSaved }: { open: boolean; onClose(): void; onSaved(message: string): void }) {
  const { code, me } = useHousehold();
  const { today, timeZone, entries, budgetFor } = usePocketMoney();
  const [amountText, setAmountText] = useState('');
  const amountRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const amountId = useId();

  useEffect(() => {
    if (!open) return;
    setAmountText('');
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const raf = requestAnimationFrame(() => amountRef.current?.focus());
    return () => { cancelAnimationFrame(raf); opener?.focus?.(); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const budget = budgetFor(me);
  if (!budget) return null;

  const balance = Math.max(0, piggyBank(budget, entries, today, timeZone));
  const amount = parseAmount(amountText);
  const tooMuch = amount !== null && amount > balance;
  const valid = amount !== null && !tooMuch;
  const newDaily = (pence: number) => allowanceStatus(budget, [...entries, {
    id: 'preview', budgetId: budget.id, by: me, day: today, amount: pence, label: BANK_LABEL, kind: 'bank', createdAt: 0,
  }], today).daily;

  function save(e: FormEvent) {
    e.preventDefault();
    if (!valid || !budget || amount === null) return;
    void addMoneyEntry(code, { budgetId: budget.id, by: me, day: today, amount, label: BANK_LABEL, kind: 'bank' }, crypto.randomUUID())
      .catch((err) => console.error(err));
    onSaved(`${formatGBP(amount)} moved to this month`);
    onClose();
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h2 id={titleId}>Move to this month</h2>
        <p className="muted">Piggy Bank: {formatGBP(balance)}</p>
        <label htmlFor={amountId}>Amount</label>
        <span className="amount-field"><span aria-hidden="true">£</span><input id={amountId} ref={amountRef} inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} placeholder="0.00" /></span>
        {amountText.trim() !== '' && amount === null && <p className="error small">Enter an amount like 4.50</p>}
        {tooMuch && <p className="error small">You have {formatGBP(balance)} in the Piggy Bank</p>}
        {balance > 0 && (
          <div className="chips">
            <button type="button" className="chip" onClick={() => setAmountText((balance / 100).toFixed(2))}>Move all {formatGBP(balance)}</button>
          </div>
        )}
        {valid && <p className="muted">Daily allowance becomes {formatGBP(newDaily(amount))}</p>}
        <div className="sheet-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!valid}>Move</button>
        </div>
      </form>
    </div>
  );
}
