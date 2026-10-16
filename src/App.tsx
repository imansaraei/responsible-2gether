import { useCallback, useEffect, useMemo, useState } from 'react';
import { isConfigured } from './firebase/config';
import { useChores, useHouseholdDoc, useSyncStatus } from './firebase/hooks';
import { loadDevice, saveDevice, type DeviceState } from './device';
import { weekIdOf } from './domain/week';
import { HouseholdContext, type HouseholdCtx } from './state/HouseholdContext';
import { OfflinePill } from './components/OfflinePill';
import { TabBar } from './components/TabBar';
import { SetupNeeded } from './screens/SetupNeeded';
import { Onboarding, WhoAreYou } from './screens/Onboarding';
import { ChoresModule } from './screens/ChoresModule';
import { MoneySoon } from './screens/MoneySoon';
import { Home } from './screens/Home';
import { Settings } from './screens/Settings';
import { syncReminders } from './push/reminders';
import type { ChoresSection, NavTarget, TabId } from './navigation';

function useCurrentWeekId(): string {
  const [id, setId] = useState(() => weekIdOf(new Date()));
  useEffect(() => {
    const t = setInterval(() => setId(weekIdOf(new Date())), 60_000);
    const onVisible = () => document.visibilityState === 'visible' && setId(weekIdOf(new Date()));
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible); };
  }, []);
  return id;
}

export default function App() {
  const [device, setDevice] = useState<DeviceState>(loadDevice);
  const updateDevice = useCallback((patch: Partial<DeviceState>) =>
    setDevice((d) => { const next = { ...d, ...patch }; saveDevice(next); return next; }), []);

  if (!isConfigured) return <SetupNeeded />;
  if (!device.code) return <Onboarding onHousehold={(code) => updateDevice({ code, me: null })} />;
  return <Household code={device.code} device={device} updateDevice={updateDevice} />;
}

function Household({ code, device, updateDevice }: { code: string; device: DeviceState; updateDevice(p: Partial<DeviceState>): void }) {
  const [attempt, setAttempt] = useState(0);
  const { members, loading, error } = useHouseholdDoc(code, attempt);
  const chores = useChores(code);
  const currentWeekId = useCurrentWeekId();
  const [tab, setTab] = useState<TabId>('home');
  const [choresSection, setChoresSection] = useState<ChoresSection>('week');
  const navigate = useCallback((t: NavTarget) => {
    setTab(t.tab);
    if (t.section) setChoresSection(t.section);
    window.scrollTo(0, 0);
  }, []);
  const offline = useSyncStatus(code) === 'offline';

  // Keep the reminder server's copy of this device fresh (time zone after travel, rotated subscription).
  useEffect(() => {
    syncReminders().catch(() => undefined);
  }, []);

  const ctx = useMemo<HouseholdCtx | null>(
    () => (members && device.me ? { code, me: device.me, members, chores, currentWeekId, device, updateDevice } : null),
    [code, members, chores, currentWeekId, device, updateDevice],
  );

  if (loading) return <main className="page narrow"><p className="muted">Loading…</p></main>;
  if (error) {
    return (
      <main className="page narrow">
        <h1>Can’t reach your household</h1>
        <p className="muted">Couldn’t load your household — check your connection.</p>
        <button className="btn primary" onClick={() => setAttempt((n) => n + 1)}>Retry</button>
      </main>
    );
  }
  if (!members) {
    return (
      <main className="page narrow">
        <h1>Household not found</h1>
        <p className="muted">The code <code>{code}</code> doesn’t exist any more.</p>
        <button className="btn" onClick={() => updateDevice({ code: null, me: null })}>Start over</button>
      </main>
    );
  }
  if (!device.me || !ctx) return <WhoAreYou members={members} onPick={(me) => updateDevice({ me })} />;

  const screen =
    tab === 'chores' ? <ChoresModule section={choresSection} onSection={setChoresSection} />
    : tab === 'money' ? <MoneySoon />
    : tab === 'settings' ? <Settings />
    : <Home onNavigate={navigate} />;
  return (
    <HouseholdContext.Provider value={ctx}>
      <div className={`app${offline ? ' has-pill' : ''}`}>
        {screen}
        <OfflinePill code={code} />
        <TabBar active={tab} onChange={(t) => navigate({ tab: t })} />
      </div>
    </HouseholdContext.Provider>
  );
}
