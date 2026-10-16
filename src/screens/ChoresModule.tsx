import type { KeyboardEvent, ReactElement } from 'react';
import { CHORES_SECTIONS, type ChoresSection } from '../navigation';
import { Dashboard } from './Dashboard';
import { Todo } from './Todo';
import { Feedback } from './Feedback';
import { Config } from './Config';

const SECTION_SCREENS: Record<ChoresSection, () => ReactElement> = {
  week: Dashboard, todo: Todo, feedback: Feedback, setup: Config,
};

export function ChoresModule({ section, onSection }: { section: ChoresSection; onSection(s: ChoresSection): void }) {
  const Screen = SECTION_SCREENS[section];
  const index = CHORES_SECTIONS.findIndex((s) => s.id === section);

  function onKeyDown(e: KeyboardEvent) {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = CHORES_SECTIONS[(index + step + CHORES_SECTIONS.length) % CHORES_SECTIONS.length];
    onSection(next.id);
    document.getElementById(`chores-tab-${next.id}`)?.focus();
  }

  return (
    <div className="module">
      <header className="module-head">
        <h1>🧺 Tidy Together</h1>
        <div className="segmented-nav" role="tablist" aria-label="Tidy Together sections" onKeyDown={onKeyDown}>
          {CHORES_SECTIONS.map((s) => (
            <button
              key={s.id}
              id={`chores-tab-${s.id}`}
              role="tab"
              aria-selected={s.id === section}
              aria-controls="chores-panel"
              tabIndex={s.id === section ? 0 : -1}
              onClick={() => onSection(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </header>
      <div id="chores-panel" role="tabpanel" aria-labelledby={`chores-tab-${section}`}>
        <Screen />
      </div>
    </div>
  );
}
