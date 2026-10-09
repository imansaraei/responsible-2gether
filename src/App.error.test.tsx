import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

let doc: { members: unknown; loading: boolean; error: boolean };
const calls: unknown[][] = [];
vi.mock('./firebase/config', () => ({ isConfigured: true }));
vi.mock('./firebase/hooks', () => ({
  useHouseholdDoc: (...a: unknown[]) => { calls.push(a); return doc; },
  useChores: () => [],
  useWeek: () => ({ completions: [], feedback: [], loading: false }),
  useSyncStatus: () => 'synced',
}));

beforeEach(() => {
  calls.length = 0;
  localStorage.setItem('r2g.device', JSON.stringify({ code: 'tidy-otter-maple-4821', me: 'a', lastExportAt: null }));
});
afterEach(() => localStorage.clear());

test('a listener error shows a retry state, not "Household not found"', async () => {
  doc = { members: null, loading: false, error: true };
  render(<App />);
  expect(screen.getByText('Couldn’t load your household — check your connection.')).toBeInTheDocument();
  expect(screen.queryByText(/Household not found/)).toBeNull();
  expect(screen.queryByRole('button', { name: 'Start over' })).toBeNull();
  const before = calls.length;
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  // Retry re-renders with a changed attempt counter so the listener is re-subscribed.
  expect(calls.at(-1)).not.toEqual(calls[before - 1]);
});

test('a genuinely missing household still offers Start over', () => {
  doc = { members: null, loading: false, error: false };
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Household not found' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Start over' })).toBeInTheDocument();
});
