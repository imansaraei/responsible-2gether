import type { ReactElement } from 'react';
import type { TabId } from '../navigation';
import { IconBasket, IconGear, IconHome, IconWallet } from './icons';


export const TABS: { id: TabId; label: string; icon: () => ReactElement }[] = [
  { id: 'home', label: 'Home', icon: IconHome },
  { id: 'chores', label: 'Chores', icon: IconBasket },
  { id: 'money', label: 'Money', icon: IconWallet },
  { id: 'settings', label: 'Settings', icon: IconGear },
];

export function TabBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  return (
    <nav className="tabbar" aria-label="Sections">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          aria-current={active === id ? 'page' : undefined}
          className={`tab${id === 'home' ? ' tab-center' : ''}`}
          onClick={() => onChange(id)}
        >
          <span className="tab-icon"><Icon /></span>
          <span className="tab-label">{label}</span>
        </button>
      ))}
    </nav>
  );
}
