import { useState, type FormEvent } from 'react';
import type { MemberId, Members } from '../domain/types';
import { generateCode, isValidCode, normalizeCode } from '../domain/householdCode';
import { createHousehold, householdExists } from '../firebase/repo';

type Step = 'choose' | 'create' | 'join';

const OFFLINE = 'You need to be online to set up a household.';

export function readJoinCode(hash: string): string | null {
  const m = /join=([a-z0-9-]+)/i.exec(hash);
  return m ? normalizeCode(m[1]) : null;
}

export function Onboarding({ onHousehold }: { onHousehold(code: string): void }) {
  const linked = readJoinCode(location.hash);
  const [step, setStepRaw] = useState<Step>(linked ? 'join' : 'choose');
  const [nameA, setNameA] = useState('');
  const [nameB, setNameB] = useState('');
  const [code, setCode] = useState(linked ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setStep = (st: Step) => { setError(null); setStepRaw(st); };

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!navigator.onLine) return setError(OFFLINE);
    if (!nameA.trim() || !nameB.trim()) return setError('Please enter both names.');
    setBusy(true); setError(null);
    try {
      const newCode = generateCode();
      await createHousehold(newCode, { a: { name: nameA.trim() }, b: { name: nameB.trim() } });
      onHousehold(newCode);
    } catch {
      setError('Couldn’t create the household. Are you online?');
    } finally { setBusy(false); }
  }

  async function join(e: FormEvent) {
    e.preventDefault();
    if (!navigator.onLine) return setError(OFFLINE);
    const c = normalizeCode(code);
    if (!isValidCode(c)) return setError('That doesn’t look like a household code (word-word-word-1234).');
    setBusy(true); setError(null);
    try {
      if (!(await householdExists(c))) { setError('No household with that code.'); return; }
      history.replaceState(null, '', location.pathname);
      onHousehold(c);
    } catch {
      setError('Couldn’t reach the server. Are you online?');
    } finally { setBusy(false); }
  }

  return (
    <main className="page narrow">
      <h1>Khooneh</h1>
      <p className="muted">Keep the home tidy, together.</p>
      {step === 'choose' && (
        <div className="stack">
          <button className="btn primary" onClick={() => setStep('create')}>Create our household</button>
          <button className="btn" onClick={() => setStep('join')}>Join with a code</button>
        </div>
      )}
      {step === 'create' && (
        <form className="card stack" onSubmit={create}>
          <label>First person’s name<input value={nameA} maxLength={30} onChange={(e) => setNameA(e.target.value)} autoFocus /></label>
          <label>Second person’s name<input value={nameB} maxLength={30} onChange={(e) => setNameB(e.target.value)} /></label>
          <button className="btn primary" disabled={busy}>{busy ? 'Creating…' : 'Create'}</button>
          <button type="button" className="btn ghost" onClick={() => setStep('choose')}>Back</button>
        </form>
      )}
      {step === 'join' && (
        <form className="card stack" onSubmit={join}>
          <label>Household code<input value={code} onChange={(e) => setCode(e.target.value)} placeholder="tidy-otter-maple-4821" autoCapitalize="none" autoFocus /></label>
          <button className="btn primary" disabled={busy}>{busy ? 'Joining…' : 'Join'}</button>
          <button type="button" className="btn ghost" onClick={() => setStep('choose')}>Back</button>
        </form>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </main>
  );
}

export function WhoAreYou({ members, onPick }: { members: Members; onPick(m: MemberId): void }) {
  return (
    <main className="page narrow">
      <h1>Who’s using this phone?</h1>
      <div className="stack">
        {(['a', 'b'] as const).map((m) => (
          <button key={m} className={`btn big member-${m}`} onClick={() => onPick(m)}>{members[m].name}</button>
        ))}
      </div>
    </main>
  );
}
