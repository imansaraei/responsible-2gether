import { useCallback, useEffect, useState } from 'react';

export function useToast(ms = 4000) {
  const [item, setItem] = useState<{ text: string; id: number } | null>(null);
  useEffect(() => {
    if (!item) return;
    const t = setTimeout(() => setItem(null), ms);
    return () => clearTimeout(t);
  }, [item, ms]);
  const show = useCallback((text: string) => setItem((p) => ({ text, id: (p?.id ?? 0) + 1 })), []);
  return { toast: item?.text ?? null, show };
}

/** Always mounted so screen readers announce changes. */
export function Toast({ text }: { text: string | null }) {
  return (
    <div role="status" aria-live="polite" className={text ? 'toast' : 'sr-only'}>
      {text ?? ''}
    </div>
  );
}
