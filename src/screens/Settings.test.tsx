import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HouseholdContext, type HouseholdCtx } from '../state/HouseholdContext';
import { Settings, backupFileName } from './Settings';

const updateMembers = vi.fn(), importHousehold = vi.fn();
vi.mock('../firebase/repo', () => ({
  updateMembers: (...a: unknown[]) => updateMembers(...a),
  exportHousehold: vi.fn(),
  importHousehold: (...a: unknown[]) => importHousehold(...a),
}));
vi.mock('../firebase/hooks', () => ({ useSyncStatus: () => 'synced' }));

afterEach(() => vi.clearAllMocks());

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
