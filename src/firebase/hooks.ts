import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { ensureSignedIn, getDb } from './app';
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

export function useHouseholdDoc(code: string) {
  const ready = useSignedIn();
  const [state, setState] = useState<{ members: Members | null; loading: boolean }>({ members: null, loading: true });
  useEffect(() => {
    if (!ready) return;
    return onSnapshot(
      doc(getDb(), 'households', code),
      (s) => setState({ members: s.exists() ? (s.data().members as Members) : null, loading: s.metadata.fromCache && !s.exists() }),
      () => setState({ members: null, loading: false }),
    );
  }, [ready, code]);
  return state;
}

export function useChores(code: string): Chore[] {
  const ready = useSignedIn();
  const [chores, setChores] = useState<Chore[]>([]);
  useEffect(() => {
    if (!ready) return;
    return onSnapshot(collection(getDb(), 'households', code, 'chores'), (s) =>
      setChores(s.docs.map((d) => toChore(d.id, d.data()))),
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
    });
    const un2 = onSnapshot(collection(getDb(), ...base, 'feedback'), (s) =>
      setFeedback(s.docs.map((d) => toFeedback(d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt)),
    );
    return () => { un1(); un2(); };
  }, [ready, code, weekId]);
  return { completions, feedback, loading };
}

export type SyncStatus = 'synced' | 'saving' | 'offline';

export function useSyncStatus(code: string): SyncStatus {
  const ready = useSignedIn();
  const [online, setOnline] = useState(() => navigator.onLine);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  useEffect(() => {
    if (!ready) return;
    // Any pending write in the household tree shows up on at least one listened query; chores is the busiest.
    return onSnapshot(collection(getDb(), 'households', code, 'chores'), { includeMetadataChanges: true },
      (s) => setPending(s.metadata.hasPendingWrites));
  }, [ready, code]);
  if (!online) return 'offline';
  return pending ? 'saving' : 'synced';
}
