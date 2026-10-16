import type { KeyboardEvent, ReactElement } from 'react';
import { MONEY_SECTIONS, type MoneySection } from '../navigation';
import { usePocketMoney } from '../state/PocketMoneyContext';
import { MoneySetup } from './MoneySetup';
import { MoneyMine } from './MoneyMine';
import { MoneyFamily } from './MoneyFamily';
import { MoneyHomePot } from './MoneyHomePot';

const SECTION_SCREENS: Record<MoneySection, () => ReactElement | null> = {
  family: MoneyFamily, mine: MoneyMine, home: MoneyHomePot,
};

export function MoneyModule({ section, onSection }: { section: MoneySection; onSection(s: MoneySection): void }) {
  const { loading, isSetUp, budgets } = usePocketMoney();
  const Screen = SECTION_SCREENS[section];
  const index = MONEY_SECTIONS.findIndex((s) => s.id === section);

  if (loading) return <main className="page narrow"><p className="muted">Loading…</p></main>;
  if (!isSetUp && budgets.length === 0) return <MoneySetup />;

  function onKeyDown(e: KeyboardEvent) {
    let nextIndex: number;
    if (e.key === 'ArrowRight') nextIndex = (index + 1) % MONEY_SECTIONS.length;
    else if (e.key === 'ArrowLeft') nextIndex = (index - 1 + MONEY_SECTIONS.length) % MONEY_SECTIONS.length;
    else if (e.key === 'Home') nextIndex = 0;
    else if (e.key === 'End') nextIndex = MONEY_SECTIONS.length - 1;
    else return;
    e.preventDefault();
    const next = MONEY_SECTIONS[nextIndex];
    onSection(next.id);
    document.getElementById(`money-tab-${next.id}`)?.focus();
  }

  return (
    <div className="module">
      <header className="module-head">
        <h1>👛 Pocket Money</h1>
        <div className="segmented-nav" role="tablist" aria-label="Pocket Money sections" onKeyDown={onKeyDown}>
          {MONEY_SECTIONS.map((s) => (
            <button
              key={s.id}
              id={`money-tab-${s.id}`}
              role="tab"
              aria-selected={s.id === section}
              aria-controls="money-panel"
              tabIndex={s.id === section ? 0 : -1}
              onClick={() => onSection(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </header>
      <div id="money-panel" role="tabpanel" aria-labelledby={`money-tab-${section}`}>
        <Screen />
      </div>
    </div>
  );
}
