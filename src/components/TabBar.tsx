import type { ReactElement } from 'react';
import { IconCheck, IconChat, IconGear, IconPie, IconSliders } from './icons';

export type TabId = 'config' | 'feedback' | 'dashboard' | 'todo' | 'settings';

export const TABS: { id: TabId; label: string; icon: () => ReactElement }[] = [
  { id: 'config', label: 'Setup', icon: IconSliders },
  { id: 'feedback', label: 'Feedback', icon: IconChat },
  { id: 'dashboard', label: 'Home', icon: IconPie },
  { id: 'todo', label: 'To-do', icon: IconCheck },
  { id: 'settings', label: 'Settings', icon: IconGear },
];

export function TabBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  return (
    <nav className="tabbar" role="tablist" aria-label="Sections">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          role="tab"
          aria-selected={active === id}
          className={`tab${id === 'dashboard' ? ' tab-center' : ''}`}
          onClick={() => onChange(id)}
        >
          <span className="tab-icon"><Icon /></span>
          <span className="tab-label">{label}</span>
        </button>
      ))}
    </nav>
  );
}
