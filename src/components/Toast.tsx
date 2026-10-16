import { useCallback, useEffect, useState } from 'react';

export function useToast(ms = 4000) {
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), ms);
    return () => clearTimeout(t);
  }, [toast, ms]);
  const show = useCallback((text: string) => setToast(text), []);
  return { toast, show };
}

/** Always mounted so screen readers announce changes. */
export function Toast({ text }: { text: string | null }) {
  return (
    <div role="status" aria-live="polite" className={text ? 'toast' : 'sr-only'}>
      {text ?? ''}
    </div>
  );
}
