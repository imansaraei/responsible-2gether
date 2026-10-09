import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { ensureSignedIn, getDb } from './app';
import { onPendingChange, pendingWrites } from './pending';
import { toChore, toCompletion, toFeedback } from './repo';
import type { Chore, Completion, Feedback, Members } from '../domain/types';

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
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!ready) return;
    setLoading(true);
    setCompletions([]);
    setFeedback([]);
    const base = ['households', code, 'weeks', weekId] as const;
    const un1 = onSnapshot(collection(getDb(), ...base, 'completions'), (s) => {
      setCompletions(s.docs.map((d) => toCompletion(d.id, d.data())));
      setLoading(false);
    }, (e) => console.error(e));
    const un2 = onSnapshot(collection(getDb(), ...base, 'feedback'), (s) =>
      setFeedback(s.docs.map((d) => toFeedback(d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt)),
      (e) => console.error(e),
    );
    return () => { un1(); un2(); };
  }, [ready, code, weekId]);
  return { completions, feedback, loading };
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
