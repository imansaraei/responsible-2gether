let count = 0;
const listeners = new Set<() => void>();

export const pendingWrites = (): number => count;

export function onPendingChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const notify = () => listeners.forEach((l) => l());

/** Counts a write as pending until its promise settles (Firestore settles on server ack). */
export function track<T>(p: Promise<T>): Promise<T> {
  count++;
  notify();
  return p.finally(() => {
    count--;
    notify();
  });
}
