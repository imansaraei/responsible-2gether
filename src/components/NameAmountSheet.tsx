import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { parseAmount } from '../domain/money';

/** A bottom sheet with a name and an amount, shared by ＋ Mission and ＋ Bill. */
export function NameAmountSheet({ open, title, nameLabel, amountLabel, maxName, submit, children, onClose, onSubmit }: {
  open: boolean; title: string; nameLabel: string; amountLabel: string; maxName: number; submit: string;
  children?: ReactNode; onClose(): void; onSubmit(name: string, amount: number): void;
}) {
  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const amountId = useId();

  useEffect(() => {
    if (!open) return;
    setName(''); setAmountText('');
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const raf = requestAnimationFrame(() => nameRef.current?.focus());
    return () => { cancelAnimationFrame(raf); opener?.focus?.(); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const amount = parseAmount(amountText);
  const valid = name.trim() !== '' && amount !== null;

  function save(e: FormEvent) {
    e.preventDefault();
    if (!valid || amount === null) return;
    onSubmit(name.trim(), amount);
    onClose();
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h2 id={titleId}>{title}</h2>
        <label>{nameLabel}
          <input ref={nameRef} value={name} maxLength={maxName} onChange={(e) => setName(e.target.value)} />
        </label>
        <label htmlFor={amountId}>{amountLabel}</label>
        <span className="amount-field"><span aria-hidden="true">£</span><input id={amountId} inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} placeholder="0.00" /></span>
        {amountText.trim() !== '' && amount === null && <p className="error small">Enter an amount like 4.50</p>}
        {children}
        <div className="sheet-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!valid}>{submit}</button>
        </div>
      </form>
    </div>
  );
}
