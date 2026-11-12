import { useState } from 'react';
import { useHousehold } from '../state/HouseholdContext';
import { usePocketMoney } from '../state/PocketMoneyContext';
import { addBill, archiveBill } from '../firebase/repo';
import { billsTotal, formatGBP } from '../domain/money';
import { NameAmountSheet } from './NameAmountSheet';

/** The viewer's monthly bills, paid on top of the allowance. */
export function BillsCard({ monthAllowance }: { monthAllowance: number }) {
  const { code, me } = useHousehold();
  const { bills } = usePocketMoney();
  const [sheet, setSheet] = useState(false);
  const mine = bills.filter((b) => b.owner === me);
  const total = billsTotal(bills, me);

  return (
    <section className="card bills" aria-labelledby="bills-title">
      <h2 id="bills-title">Bills</h2>
      {mine.length === 0 ? <p className="muted small">No bills yet.</p> : (
        <ul className="bill-list">
          {mine.map((b) => (
            <li key={b.id} className="bill-row">
              <span className="bill-name">{b.name}</span>
              <span className="entry-amount">{formatGBP(b.amount)}</span>
              <button className="btn ghost small" aria-label={`Remove ${b.name}`} onClick={() => { void archiveBill(code, b.id).catch(console.error); }}>Remove</button>
            </li>
          ))}
        </ul>
      )}
      <p className="small">This month: allowance {formatGBP(monthAllowance)} + bills {formatGBP(total)} = {formatGBP(monthAllowance + total)}</p>
      <button className="btn" onClick={() => setSheet(true)}>＋ Bill</button>
      <NameAmountSheet
        open={sheet} title="New bill" nameLabel="Name" amountLabel="Amount a month" maxName={40} submit="Add bill"
        onClose={() => setSheet(false)}
        onSubmit={(name, amount) => { void addBill(code, { owner: me, name, amount }).catch(console.error); }}
      />
    </section>
  );
}
