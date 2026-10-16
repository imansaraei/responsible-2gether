import { useState, type FormEvent } from 'react';
import { useHousehold } from '../state/HouseholdContext';
import { usePocketMoney } from '../state/PocketMoneyContext';
import { setupPocketMoney } from '../firebase/repo';
import { DEFAULT_HOME_ALLOWANCE, defaultAllowanceFor, parseAmount } from '../domain/money';

const plain = (pence: number) => (pence / 100).toFixed(2);

export function MoneySetup() {
  const { code, members } = useHousehold();
  const { budgets } = usePocketMoney();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London';
  const [a, setA] = useState(plain(defaultAllowanceFor(members.a.name)));
  const [b, setB] = useState(plain(defaultAllowanceFor(members.b.name)));
  const [home, setHome] = useState(plain(DEFAULT_HOME_ALLOWANCE));
  const [started, setStarted] = useState(false);
  const pa = parseAmount(a), pb = parseAmount(b), ph = parseAmount(home);
  const valid = pa !== null && pb !== null && ph !== null;
  const bad = (t: string, p: number | null) => t.trim() !== '' && p === null;
  const showError = bad(a, pa) || bad(b, pb) || bad(home, ph) || (!valid);

  function start(e: FormEvent) {
    e.preventDefault();
    if (!valid || started || budgets.length > 0) return;
    setStarted(true);
    setupPocketMoney(code, {
      timeZone, personal: { a: pa, b: pb }, home: ph, names: { a: members.a.name, b: members.b.name },
    }).catch((err) => { console.error(err); setStarted(false); });
  }

  return (
    <main className="page">
      <h1>👛 Pocket Money</h1>
      <p className="muted">Set the monthly allowances. Each person’s is theirs to spend on anything; the Home pot is shared.</p>
      <form className="card stack" onSubmit={start}>
        <label>{members.a.name}’s monthly allowance
          <input inputMode="decimal" value={a} onChange={(e) => setA(e.target.value)} />
        </label>
        <label>{members.b.name}’s monthly allowance
          <input inputMode="decimal" value={b} onChange={(e) => setB(e.target.value)} />
        </label>
        <label>Home pot per month
          <input inputMode="decimal" value={home} onChange={(e) => setHome(e.target.value)} />
        </label>
        {showError && <p className="error small">Enter an amount like 250</p>}
        <p className="muted small">Days follow {timeZone} time.</p>
        <button className="btn primary big" disabled={!valid || started}>Start Pocket Money</button>
      </form>
    </main>
  );
}
