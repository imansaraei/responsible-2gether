import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MoneyMissions } from './MoneyMissions';
import { Providers, money } from './moneyFixtures';
import type { Mission } from '../domain/types';

const addMission = vi.fn(async () => {});
const setMissionStatus = vi.fn(async () => {});
const approveMission = vi.fn(async () => {});
vi.mock('../firebase/repo', () => ({
  addMission: (...a: unknown[]) => addMission(...(a as [])),
  setMissionStatus: (...a: unknown[]) => setMissionStatus(...(a as [])),
  approveMission: (...a: unknown[]) => approveMission(...(a as [])),
}));
afterEach(() => vi.clearAllMocks());

// The viewer is Tahereh (b); Iman is a.
const mission = (p: Partial<Mission> & Pick<Mission, 'id'>): Mission => ({
  from: 'a', to: 'b', title: 'Clean the cupboards', gift: 500, status: 'open',
  createdAt: Date.parse('2026-10-10T09:00:00Z'), updatedAt: Date.parse('2026-10-10T09:00:00Z'), ...p,
});
const view = (missions: Mission[]) => render(<Providers ctx={money({ missions })}><MoneyMissions /></Providers>);

test('＋ Mission creates one for the partner', async () => {
  view([]);
  await userEvent.click(screen.getByRole('button', { name: '＋ Mission' }));
  const sheet = screen.getByRole('dialog', { name: 'New mission' });
  expect(sheet).toHaveTextContent('For Iman.');
  await userEvent.type(within(sheet).getByLabelText('Mission'), 'Wash the car');
  await userEvent.type(within(sheet).getByLabelText('Gift'), '7.50');
  await userEvent.click(within(sheet).getByRole('button', { name: 'Set mission' }));
  expect(addMission).toHaveBeenCalledWith('c', { from: 'b', title: 'Wash the car', gift: 750 });
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('the assignee marks an open mission done', async () => {
  view([mission({ id: 'm1' })]);
  await userEvent.click(screen.getByRole('button', { name: 'Mark Clean the cupboards done' }));
  expect(setMissionStatus).toHaveBeenCalledWith('c', 'm1', 'done');
  expect(screen.queryByRole('button', { name: /^Approve/ })).toBeNull();
});

test('only the giver sees Approve; it calls approveMission with today', async () => {
  view([
    mission({ id: 'mine', from: 'b', to: 'a', title: 'Fix the shelf', status: 'done' }),
    mission({ id: 'theirs', status: 'done' }),
  ]);
  expect(screen.getAllByRole('button', { name: /^Approve/ })).toHaveLength(1);
  await userEvent.click(screen.getByRole('button', { name: 'Approve Fix the shelf £5.00' }));
  expect(approveMission).toHaveBeenCalledWith('c', expect.objectContaining({ id: 'mine', from: 'b', to: 'a', gift: 500 }), '2026-10-16');
  await userEvent.click(screen.getByRole('button', { name: 'Not yet: Fix the shelf' }));
  expect(setMissionStatus).toHaveBeenCalledWith('c', 'mine', 'open');
  expect(screen.queryByRole('button', { name: 'Mark Clean the cupboards done' })).toBeNull();
});

test('the giver can cancel an open mission', async () => {
  view([mission({ id: 'm2', from: 'b', to: 'a' })]);
  await userEvent.click(screen.getByRole('button', { name: 'Cancel Clean the cupboards' }));
  expect(setMissionStatus).toHaveBeenCalledWith('c', 'm2', 'cancelled');
});

test('History lists only this month’s approved and cancelled missions', () => {
  view([
    mission({ id: 'h1', title: 'Old one', status: 'approved', updatedAt: Date.parse('2026-09-20T09:00:00Z') }),
    mission({ id: 'h2', title: 'Done deal', status: 'approved' }),
  ]);
  expect(screen.getByRole('heading', { name: 'History' })).toBeInTheDocument();
  expect(screen.getByText('Done deal')).toBeInTheDocument();
  expect(screen.queryByText('Old one')).toBeNull();
});
