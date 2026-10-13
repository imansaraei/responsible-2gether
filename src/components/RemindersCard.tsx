import { useEffect, useState } from 'react';
import {
  disableReminders, enableReminders, getReminderState, reminderSupport, type ReminderState,
} from '../push/reminders';

export function RemindersCard() {
  const support = reminderSupport();
  const [state, setState] = useState<ReminderState | 'loading'>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (support !== 'supported') return;
    let alive = true;
    getReminderState().then((s) => alive && setState(s)).catch(() => alive && setState('off'));
    return () => { alive = false; };
  }, [support]);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      setState(state === 'on' ? await disableReminders() : await enableReminders());
    } catch {
      setError('Couldn’t update reminders. Are you online?');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card stack">
      <p className="muted small">
        A nudge at 10:00 and 22:00 your phone’s time: <span lang="fa" dir="rtl">«کارهای امروز رو ثبت کردی؟»</span>
      </p>
      {support === 'needs-install' && (
        <p className="notice">On iPhone, add the app to your Home Screen first (Share › Add to Home Screen), then turn reminders on from the installed app.</p>
      )}
      {support === 'unsupported' && <p className="muted">This browser can’t show notifications.</p>}
      {support === 'supported' && state === 'blocked' && (
        <p className="notice">Notifications are blocked for this app. Allow them in your phone’s settings, then come back here.</p>
      )}
      {support === 'supported' && state !== 'blocked' && (
        <button
          className={`btn ${state === 'on' ? '' : 'primary'}`}
          role="switch"
          aria-checked={state === 'on'}
          disabled={busy || state === 'loading'}
          onClick={toggle}
        >
          {state === 'on' ? 'Daily reminders: on — turn off' : 'Turn on daily reminders'}
        </button>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
