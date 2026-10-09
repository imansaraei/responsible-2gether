import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HouseholdContext, type HouseholdCtx } from '../state/HouseholdContext';
import { Settings, backupFileName, saveBackupFile } from './Settings';

const updateMembers = vi.fn(), importHousehold = vi.fn(), exportHousehold = vi.fn();
vi.mock('../firebase/repo', () => ({
  updateMembers: (...a: unknown[]) => updateMembers(...a),
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
  expect(updateMembers).toHaveBeenCalledWith('tidy-otter-maple-4821', { a: { name: 'Iman' }, b: { name: 'Samira' } });
});

test('a remote rename is shown and not overwritten by a plain focus/blur', async () => {
  const { rerender } = renderIt();
  rerender(wrap({ ...ctx, members: { a: { name: 'Iman' }, b: { name: 'Samira' } } }));
  const input = screen.getByLabelText('Person 2 name');
  expect(input).toHaveValue('Samira');
  await userEvent.click(input);
  await userEvent.tab();
  expect(updateMembers).not.toHaveBeenCalled();
  expect(input).toHaveValue('Samira');
});

test('pressing Enter commits the rename', async () => {
  renderIt();
  const input = screen.getByLabelText('Person 2 name');
  await userEvent.type(input, 'x{Enter}');
  expect(updateMembers).toHaveBeenCalledWith('tidy-otter-maple-4821', { a: { name: 'Iman' }, b: { name: 'Samx' } });
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
