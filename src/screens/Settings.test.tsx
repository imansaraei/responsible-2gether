import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HouseholdContext, type HouseholdCtx } from '../state/HouseholdContext';
import { Settings, backupFileName, saveBackupFile } from './Settings';

const renameMember = vi.fn(), importHousehold = vi.fn(), exportHousehold = vi.fn();
vi.mock('../firebase/repo', () => ({
  renameMember: (...a: unknown[]) => renameMember(...a),
  exportHousehold: (...a: unknown[]) => exportHousehold(...a),
  importHousehold: (...a: unknown[]) => importHousehold(...a),
}));
vi.mock('../firebase/hooks', () => ({ useSyncStatus: () => 'synced' }));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, 'canShare');
  Reflect.deleteProperty(navigator, 'share');
  Reflect.deleteProperty(navigator, 'clipboard');
});

const backup = {
  version: 1, exportedAt: 1, code: 'tidy-otter-maple-4821',
  members: { a: { name: 'Iman' }, b: { name: 'Sam' } }, chores: [], weeks: {},
};
const setNav = (o: object) => Object.defineProperties(navigator, Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { value: v, configurable: true }])));
const testFile = () => new File(['{}'], 'b.json', { type: 'application/json' });

const updateDevice = vi.fn();
const ctx: HouseholdCtx = {
  code: 'tidy-otter-maple-4821', me: 'a', currentWeekId: '2026-W41',
  members: { a: { name: 'Iman' }, b: { name: 'Sam' } }, chores: [],
  device: { code: 'tidy-otter-maple-4821', me: 'a', lastExportAt: null }, updateDevice,
};
const wrap = (c: HouseholdCtx) => <HouseholdContext.Provider value={c}><Settings /></HouseholdContext.Provider>;
const renderIt = () => render(wrap(ctx));

test('backupFileName', () => {
  expect(backupFileName(new Date(2026, 9, 9))).toBe('responsible-2gether-backup-2026-10-09.json');
});

test('shows code, sync status and export reminder', () => {
  renderIt();
  expect(screen.getByText('tidy-otter-maple-4821')).toBeInTheDocument();
  expect(screen.getByText(/Synced/)).toBeInTheDocument();
  expect(screen.getByText(/haven’t exported a backup/)).toBeInTheDocument();
});

test('switching who this device is', async () => {
  renderIt();
  await userEvent.click(screen.getByRole('radio', { name: 'Sam' }));
  expect(updateDevice).toHaveBeenCalledWith({ me: 'b' });
});

test('renaming a member saves on blur', async () => {
  renderIt();
  const input = screen.getByLabelText('Person 2 name');
  await userEvent.clear(input);
  await userEvent.type(input, 'Samira');
  await userEvent.tab();
  expect(renameMember).toHaveBeenCalledWith('tidy-otter-maple-4821', 'b', 'Samira');
});

test('a remote rename is shown and not overwritten by a plain focus/blur', async () => {
  const { rerender } = renderIt();
  rerender(wrap({ ...ctx, members: { a: { name: 'Iman' }, b: { name: 'Samira' } } }));
  const input = screen.getByLabelText('Person 2 name');
  expect(input).toHaveValue('Samira');
  await userEvent.click(input);
  await userEvent.tab();
  expect(renameMember).not.toHaveBeenCalled();
  expect(input).toHaveValue('Samira');
});

test('pressing Enter commits the rename', async () => {
  renderIt();
  const input = screen.getByLabelText('Person 2 name');
  await userEvent.type(input, 'x{Enter}');
  expect(renameMember).toHaveBeenCalledWith('tidy-otter-maple-4821', 'b', 'Samx');
});

test('rejects an invalid import file', async () => {
  renderIt();
  const file = new File(['{"version": 9}'], 'bad.json', { type: 'application/json' });
  await userEvent.upload(screen.getByLabelText(/Import backup/), file);
  expect(await screen.findByText(/Unsupported backup version/)).toBeInTheDocument();
  expect(importHousehold).not.toHaveBeenCalled();
});

test('saveBackupFile shares the file when the platform can', async () => {
  const share = vi.fn().mockResolvedValue(undefined);
  setNav({ canShare: () => true, share });
  expect(await saveBackupFile(testFile())).toBe('shared');
  expect(share).toHaveBeenCalledWith(expect.objectContaining({ files: [expect.any(File)] }));
});

test('saveBackupFile reports a dismissed share sheet as cancelled', async () => {
  setNav({ canShare: () => true, share: vi.fn().mockRejectedValue(new DOMException('x', 'AbortError')) });
  expect(await saveBackupFile(testFile())).toBe('cancelled');
});

test('saveBackupFile rethrows other share errors', async () => {
  setNav({ canShare: () => true, share: vi.fn().mockRejectedValue(new Error('boom')) });
  await expect(saveBackupFile(testFile())).rejects.toThrow('boom');
});

test('saveBackupFile falls back to an anchor and revokes the URL later', async () => {
  vi.useFakeTimers();
  const create = vi.fn(() => 'blob:x'), revoke = vi.fn();
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }));
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  expect(await saveBackupFile(testFile())).toBe('downloaded');
  expect(click).toHaveBeenCalled();
  expect(document.querySelector('a[download]')).toBeNull();
  expect(revoke).not.toHaveBeenCalled();
  vi.advanceTimersByTime(10_000);
  expect(revoke).toHaveBeenCalledWith('blob:x');
});

test('a cancelled export share does not record lastExportAt', async () => {
  exportHousehold.mockResolvedValue(backup);
  setNav({ canShare: () => true, share: vi.fn().mockRejectedValue(new DOMException('x', 'AbortError')) });
  renderIt();
  await userEvent.click(screen.getByRole('button', { name: /Export backup/ }));
  expect(await screen.findByText('Export cancelled.')).toBeInTheDocument();
  expect(updateDevice).not.toHaveBeenCalled();
});

test('a successful export share records lastExportAt', async () => {
  exportHousehold.mockResolvedValue(backup);
  setNav({ canShare: () => true, share: vi.fn().mockResolvedValue(undefined) });
  renderIt();
  await userEvent.click(screen.getByRole('button', { name: /Export backup/ }));
  expect(await screen.findByText(/Backup saved/)).toBeInTheDocument();
  expect(updateDevice).toHaveBeenCalledWith({ lastExportAt: expect.any(Number) });
});

test('declining the import confirm does not import', async () => {
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
  renderIt();
  const file = new File([JSON.stringify(backup)], 'ok.json', { type: 'application/json' });
  await userEvent.upload(screen.getByLabelText(/Import backup/), file);
  await vi.waitFor(() => expect(confirmSpy).toHaveBeenCalled());
  expect(confirmSpy.mock.calls[0][0]).toMatch(/can’t be undone/);
  expect(importHousehold).not.toHaveBeenCalled();
});

test('share link falls back to showing the link on non-abort failure', async () => {
  setNav({ share: vi.fn().mockRejectedValue(new Error('nope')) });
  renderIt();
  await userEvent.click(screen.getByRole('button', { name: 'Share join link' }));
  expect(await screen.findByText(/Couldn’t share — copy this link: .*#join=tidy-otter-maple-4821/)).toBeInTheDocument();
});

test('saveBackupFile reports a blocked share (expired user activation) as needs-tap', async () => {
  setNav({ canShare: () => true, share: vi.fn().mockRejectedValue(new DOMException('x', 'NotAllowedError')) });
  expect(await saveBackupFile(testFile())).toBe('needs-tap');
});

test('a blocked share shows a Save button whose tap shares; lastExportAt is set only after success', async () => {
  exportHousehold.mockResolvedValue(backup);
  const share = vi.fn()
    .mockRejectedValueOnce(new DOMException('x', 'NotAllowedError'))
    .mockResolvedValueOnce(undefined);
  setNav({ canShare: () => true, share });
  renderIt();
  await userEvent.click(screen.getByRole('button', { name: /Export backup/ }));
  const save = await screen.findByRole('button', { name: 'Save backup file' });
  expect(updateDevice).not.toHaveBeenCalled();
  await userEvent.click(save);
  expect(share).toHaveBeenCalledTimes(2);
  expect(await screen.findByText(/Backup saved/)).toBeInTheDocument();
  expect(updateDevice).toHaveBeenCalledWith({ lastExportAt: expect.any(Number) });
  expect(screen.queryByRole('button', { name: 'Save backup file' })).toBeNull();
});

test('a failed export logs the error', async () => {
  const err = vi.spyOn(console, 'error').mockImplementation(() => {});
  exportHousehold.mockRejectedValue(new Error('offline'));
  renderIt();
  await userEvent.click(screen.getByRole('button', { name: /Export backup/ }));
  expect(await screen.findByText('Export failed.')).toBeInTheDocument();
  expect(err).toHaveBeenCalled();
});

test('Copy code puts the code on the clipboard', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  setNav({ clipboard: { writeText } });
  renderIt();
  await userEvent.click(screen.getByRole('button', { name: 'Copy code' }));
  expect(writeText).toHaveBeenCalledWith('tidy-otter-maple-4821');
  expect(await screen.findByText('Code copied.')).toBeInTheDocument();
});

test('Copy code shows the code when the clipboard is unavailable', async () => {
  setNav({ clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
  renderIt();
  await userEvent.click(screen.getByRole('button', { name: 'Copy code' }));
  expect(await screen.findByText(/Couldn’t copy — your code is: tidy-otter-maple-4821/)).toBeInTheDocument();
});

test('import confirm warns when the backup is from a different household', async () => {
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
  renderIt();
  const other = { ...backup, code: 'calm-fox-pine-1234' };
  await userEvent.upload(screen.getByLabelText(/Import backup/), new File([JSON.stringify(other)], 'o.json', { type: 'application/json' }));
  await vi.waitFor(() => expect(confirmSpy).toHaveBeenCalled());
  expect(confirmSpy.mock.calls[0][0]).toContain('This backup is from a different household (calm-fox-pine-1234).');
});

test('import confirm has no different-household warning for the same code', async () => {
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
  renderIt();
  await userEvent.upload(screen.getByLabelText(/Import backup/), new File([JSON.stringify(backup)], 'o.json', { type: 'application/json' }));
  await vi.waitFor(() => expect(confirmSpy).toHaveBeenCalled());
  expect(confirmSpy.mock.calls[0][0]).not.toContain('different household');
});
