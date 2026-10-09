import { useState, type ChangeEvent } from 'react';
import { useHousehold } from '../state/HouseholdContext';
import { useSyncStatus } from '../firebase/hooks';
import { exportHousehold, importHousehold, renameMember } from '../firebase/repo';
import { validateBackup } from '../domain/backup';
import { exportReminderDue } from '../device';
import { MEMBER_IDS, type MemberId } from '../domain/types';

const pad = (n: number) => String(n).padStart(2, '0');
export const backupFileName = (d: Date) =>
  `responsible-2gether-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;

const errName = (e: unknown) => (e as { name?: unknown } | null)?.name;
const isAbort = (e: unknown) => errName(e) === 'AbortError';

/** Share sheet where files can be shared (iOS "Save to Files", Android Drive); anchor download otherwise. */
export async function saveBackupFile(file: File): Promise<'shared' | 'downloaded' | 'cancelled' | 'needs-tap'> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Responsible 2gether backup' });
      return 'shared';
    } catch (e) {
      if (isAbort(e)) return 'cancelled';
      // User activation expired (slow export): the caller must offer a fresh tap.
      if (errName(e) === 'NotAllowedError') return 'needs-tap';
      throw e;
    }
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

const SYNC_LABEL = { synced: '● Synced', saving: '◌ Saving…', offline: '○ Offline — changes will sync later' };

export function Settings() {
  const { code, me, members, device, updateDevice } = useHousehold();
  const sync = useSyncStatus(code);
  // A field is "dirty" only after the user typed in it; otherwise it mirrors the synced name.
  const [drafts, setDrafts] = useState<Partial<Record<MemberId, string>>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const link = `${location.origin}${import.meta.env.BASE_URL}#join=${code}`;

  const saveName = (m: MemberId) => {
    const draft = drafts[m];
    if (draft === undefined) return; // untouched: never overwrite a remote rename
    setDrafts(({ [m]: _discard, ...rest }) => rest);
    const n = draft.trim().slice(0, 30);
    if (n && n !== members[m].name) void renameMember(code, m, n);
  };

  async function copyCode() {
    try { await navigator.clipboard.writeText(code); setMsg('Code copied.'); }
    catch { setMsg(`Couldn’t copy — your code is: ${code}`); }
  }

  async function share() {
    const text = `Join our Responsible 2gether household: ${link}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Responsible 2gether', text, url: link });
      else { await navigator.clipboard.writeText(link); setMsg('Link copied.'); }
    } catch (e) {
      if (!isAbort(e)) setMsg(`Couldn’t share — copy this link: ${link}`);
    }
  }

  /** Shared by the first export and the "Save backup file" retry tap. */
  function finishSave(result: Awaited<ReturnType<typeof saveBackupFile>>, file: File) {
    if (result === 'cancelled') { setPendingFile(null); return setMsg('Export cancelled.'); }
    if (result === 'needs-tap') {
      setPendingFile(file);
      return setMsg('Backup is ready — tap “Save backup file” to save it.');
    }
    setPendingFile(null);
    updateDevice({ lastExportAt: Date.now() });
    setMsg('Backup saved. Keep it somewhere safe (e.g. iCloud Drive / Google Drive).');
  }

  async function doExport() {
    setMsg('Exporting…');
    setPendingFile(null);
    try {
      const backup = await exportHousehold(code);
      const file = new File([JSON.stringify(backup, null, 2)], backupFileName(new Date()), { type: 'application/json' });
      finishSave(await saveBackupFile(file), file);
    } catch (e) {
      console.error(e);
      setMsg('Export failed.');
    }
  }

  async function saveAgain() {
    const file = pendingFile;
    if (!file) return;
    try {
      finishSave(await saveBackupFile(file), file);
    } catch (e) {
      console.error(e);
      setMsg('Export failed.');
    }
  }

  async function doImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    let parsed: unknown;
    try { parsed = JSON.parse(await file.text()); } catch { return setMsg('That file isn’t valid JSON.'); }
    const r = validateBackup(parsed);
    if (!r.ok) return setMsg(r.error);
    const foreign = r.backup.code !== code ? ` This backup is from a different household (${r.backup.code}).` : '';
    if (!confirm(`Replace ALL data in this household with the backup from ${new Date(r.backup.exportedAt).toLocaleString()}? This can’t be undone — export a backup of the current data first if you might need it.${foreign}`)) return;
    setMsg('Importing…');
    try { await importHousehold(code, r.backup); setMsg('Backup restored.'); }
    catch { setMsg('Import failed. Are you online?'); }
  }

  return (
    <main className="page">
      <h1>Settings</h1>

      <h2>This phone belongs to</h2>
      <div className="kind-toggle" role="radiogroup" aria-label="This phone belongs to">
        {MEMBER_IDS.map((m) => (
          <button key={m} role="radio" aria-checked={me === m} className={me === m ? 'on plus' : ''} onClick={() => updateDevice({ me: m })}>{members[m].name}</button>
        ))}
      </div>

      <h2>Names</h2>
      <div className="card stack">
        {MEMBER_IDS.map((m, i) => (
          <label key={m}>Person {i + 1} name
            <input value={drafts[m] ?? members[m].name} maxLength={30}
              onChange={(e) => setDrafts((s) => ({ ...s, [m]: e.target.value }))}
              onBlur={() => saveName(m)}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
          </label>
        ))}
      </div>

      <h2>Household</h2>
      <div className="card stack">
        <div>Code: <code className="code">{code}</code></div>
        <button className="btn" onClick={copyCode}>Copy code</button>
        <button className="btn" onClick={share}>Share join link</button>
        <div className={`sync sync-${sync}`}>{SYNC_LABEL[sync]}</div>
      </div>

      <h2>Backup</h2>
      <div className="card stack">
        {exportReminderDue(device.lastExportAt, Date.now()) && (
          <p className="notice">You haven’t exported a backup in the last 30 days.</p>
        )}
        {device.lastExportAt && <p className="muted small">Last export from this phone: {new Date(device.lastExportAt).toLocaleDateString()}</p>}
        <button className="btn primary" onClick={doExport}>Export backup (JSON)</button>
        {pendingFile && <button className="btn primary" onClick={saveAgain}>Save backup file</button>}
        <label className="btn file">Import backup…
          <input type="file" accept="application/json,.json" onChange={doImport} className="sr-only" />
        </label>
        {msg && <p className="muted small" role="status">{msg}</p>}
      </div>

      <h2>Danger zone</h2>
      <button className="btn danger" onClick={() => {
        if (confirm('Remove this household from this phone? Data stays in the cloud; you can rejoin with the code.')) updateDevice({ code: null, me: null });
      }}>Leave household on this phone</button>
    </main>
  );
}
