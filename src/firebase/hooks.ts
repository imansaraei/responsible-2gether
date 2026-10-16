import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { ensureSignedIn, getDb } from './app';
import { onPendingChange, pendingWrites } from './pending';
import { toBudget, toChore, toCompletion, toFeedback, toLog, toMoneyEntry, toMoneySettings } from './repo';
import type { Budget, Chore, ChoreLog, Completion, Feedback, Members, MoneyEntry, MoneySettings } from '../domain/types';
import { monthRange } from '../domain/money';

function useSignedIn(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    // Offline first launch: sign-in fails, but cached reads still work once a prior session exists.
    ensureSignedIn().catch(() => undefined).finally(() => alive && setReady(true));
    return () => { alive = false; };
  }, []);
  return ready;
}

export interface HouseholdDocState { members: Members | null; loading: boolean; error: boolean }

/** `attempt` is bumped by the UI to re-subscribe after a listener error. */
export function useHouseholdDoc(code: string, attempt = 0): HouseholdDocState {
  const ready = useSignedIn();
  const [state, setState] = useState<HouseholdDocState>({ members: null, loading: true, error: false });
  useEffect(() => {
    if (!ready) return;
    setState({ members: null, loading: true, error: false });
    return onSnapshot(
      doc(getDb(), 'households', code),
      { includeMetadataChanges: true },
      (s) => {
        if (s.exists()) return setState({ members: s.data().members as Members, loading: false, error: false });
        // A missing doc in the cache only means "not seen yet"; only a server snapshot proves it is gone.
        setState({ members: null, loading: s.metadata.fromCache, error: false });
      },
      (e) => { console.error(e); setState({ members: null, loading: false, error: true }); },
    );
  }, [ready, code, attempt]);
  return state;
}

export function useChores(code: string): Chore[] {
  const ready = useSignedIn();
  const [chores, setChores] = useState<Chore[]>([]);
  useEffect(() => {
    if (!ready) return;
    return onSnapshot(collection(getDb(), 'households', code, 'chores'), (s) =>
      setChores(s.docs.map((d) => toChore(d.id, d.data()))),
      (e) => console.error(e),
    );
  }, [ready, code]);
  return chores;
}

export function useWeek(code: string, weekId: string) {
  const ready = useSignedIn();
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [logs, setLogs] = useState<ChoreLog[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!ready) return;
    setLoading(true);
    setCompletions([]);
    setFeedback([]);
    setLogs([]);
    const base = ['households', code, 'weeks', weekId] as const;
    const seen = { completions: false, logs: false };
    const settle = () => { if (seen.completions && seen.logs) setLoading(false); };
    const un1 = onSnapshot(collection(getDb(), ...base, 'completions'), (s) => {
      setCompletions(s.docs.map((d) => toCompletion(d.id, d.data())));
      seen.completions = true;
      settle();
    }, (e) => { console.error(e); seen.completions = true; settle(); });
    const un2 = onSnapshot(collection(getDb(), ...base, 'feedback'), (s) =>
      setFeedback(s.docs.map((d) => toFeedback(d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt)),
      (e) => console.error(e),
    );
    const un3 = onSnapshot(collection(getDb(), ...base, 'logs'), (s) => {
      setLogs(s.docs.map((d) => toLog(d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt));
      seen.logs = true;
      settle();
    }, (e) => { console.error(e); seen.logs = true; settle(); });
    return () => { un1(); un2(); un3(); };
  }, [ready, code, weekId]);
  return { completions, feedback, logs, loading };
}

export type SyncStatus = 'synced' | 'saving' | 'offline';

export function useSyncStatus(_code: string): SyncStatus {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [pending, setPending] = useState(() => pendingWrites() > 0);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  useEffect(() => {
    setPending(pendingWrites() > 0);
    return onPendingChange(() => setPending(pendingWrites() > 0));
  }, []);
  if (!online) return 'offline';
  return pending ? 'saving' : 'synced';
}

export function useMoney(code: string, monthKey: string) {
  const ready = useSignedIn();
  const [settings, setSettings] = useState<MoneySettings | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [entries, setEntries] = useState<MoneyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!ready) return;
    setLoading(true);
    const seen = { settings: false, budgets: false, entries: false };
    const settle = () => { if (seen.settings && seen.budgets && seen.entries) setLoading(false); };
    const mark = (k: keyof typeof seen) => { seen[k] = true; settle(); };
    const db = getDb();
    const { first, last } = monthRange(monthKey);
    const un1 = onSnapshot(doc(db, 'households', code, 'settings', 'app'),
      (s) => { setSettings(toMoneySettings(s.exists() ? s.data() : undefined)); mark('settings'); },
      (e) => { console.error(e); mark('settings'); });
    const un2 = onSnapshot(collection(db, 'households', code, 'budgets'),
      (s) => { setBudgets(s.docs.map((d) => toBudget(d.id, d.data())).filter((b) => b.archivedAt === null).sort((a, b) => a.order - b.order)); mark('budgets'); },
      (e) => { console.error(e); mark('budgets'); });
    const un3 = onSnapshot(query(collection(db, 'households', code, 'money'), where('day', '>=', first), where('day', '<=', last)),
      (s) => { setEntries(s.docs.map((d) => toMoneyEntry(d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt)); mark('entries'); },
      (e) => { console.error(e); mark('entries'); });
    return () => { un1(); un2(); un3(); };
  }, [ready, code, monthKey]);
  return { settings, budgets, entries, loading };
}
