import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { isConfigured } from './firebase/config';
import { useChores, useHouseholdDoc, useSyncStatus } from './firebase/hooks';
import { loadDevice, saveDevice, type DeviceState } from './device';
import { weekIdOf } from './domain/week';
import { HouseholdContext, type HouseholdCtx } from './state/HouseholdContext';
import { OfflinePill } from './components/OfflinePill';
import { TabBar, type TabId } from './components/TabBar';
import { SetupNeeded } from './screens/SetupNeeded';
import { Onboarding, WhoAreYou } from './screens/Onboarding';
import { Dashboard } from './screens/Dashboard';
import { Todo } from './screens/Todo';
import { Feedback } from './screens/Feedback';
import { Config } from './screens/Config';
import { Settings } from './screens/Settings';
import { syncReminders } from './push/reminders';

const SCREENS: Record<TabId, () => ReactElement> = { config: Config, feedback: Feedback, dashboard: Dashboard, todo: Todo, settings: Settings };

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
  const [tab, setTab] = useState<TabId>('dashboard');
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

  const Screen = SCREENS[tab];
  return (
    <HouseholdContext.Provider value={ctx}>
      <div className={`app${offline ? ' has-pill' : ''}`}>
        <Screen />
        <OfflinePill code={code} />
        <TabBar active={tab} onChange={setTab} />
      </div>
    </HouseholdContext.Provider>
  );
}
