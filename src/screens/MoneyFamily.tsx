import { useHousehold } from '../state/HouseholdContext';
import { usePocketMoney } from '../state/PocketMoneyContext';
import { allowanceStatus, formatGBP } from '../domain/money';
import { memberColor } from '../components/colors';

export function MoneyFamily() {
  const { members } = useHousehold();
  const { today, entries, budgetFor } = usePocketMoney();
  const rows = [
    { key: 'a', name: members.a.name, color: memberColor('a'), budget: budgetFor('a') },
    { key: 'b', name: members.b.name, color: memberColor('b'), budget: budgetFor('b') },
    { key: 'home', name: 'Home pot', color: 'var(--accent)', budget: budgetFor('shared') },
  ];
  return (
    <main className="page">
      <ul className="cards">
        {rows.filter((r) => r.budget).map((r) => {
          const s = allowanceStatus(r.budget!, entries, today);
          return (
            <li key={r.key} className="card family-row">
              <span className="dot" style={{ background: r.color }} aria-hidden="true" />
              <strong>{r.name}</strong>
              <span className={`big${s.monthLeft < 0 ? ' over' : ''}`}>{formatGBP(s.monthLeft)} left</span>
              <span className="muted">{formatGBP(s.monthSpent)} spent</span>
            </li>
          );
        })}
      </ul>
      <p className="muted small">Totals only — each person’s purchases stay private to them.</p>
    </main>
  );
}
