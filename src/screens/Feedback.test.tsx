import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HouseholdContext, type HouseholdCtx } from '../state/HouseholdContext';
import type { Feedback as FB } from '../domain/types';
import { Feedback } from './Feedback';

const addFeedback = vi.fn();
const deleteFeedback = vi.fn();
let weekFeedback: FB[] = [];
vi.mock('../firebase/repo', () => ({
  addFeedback: (...a: unknown[]) => addFeedback(...a),
  deleteFeedback: (...a: unknown[]) => deleteFeedback(...a),
}));
vi.mock('../firebase/hooks', () => ({ useWeek: () => ({ loading: false, completions: [], feedback: weekFeedback }) }));

const ctx: HouseholdCtx = {
  code: 'tidy-otter-maple-4821', me: 'a', currentWeekId: '2026-W41',
  members: { a: { name: 'Iman' }, b: { name: 'Sam' } }, chores: [],
  device: { code: 'tidy-otter-maple-4821', me: 'a', lastExportAt: null }, updateDevice: () => {},
};
const fb = (kind: 'plus' | 'minus', i: number): FB => ({ id: `${kind}${i}`, from: 'a', to: 'b', kind, text: `${kind} ${i}`, createdAt: i, resolved: false });
const renderIt = () => render(<HouseholdContext.Provider value={ctx}><Feedback /></HouseholdContext.Provider>);

beforeEach(() => { weekFeedback = []; addFeedback.mockReset(); });

test('sends positive feedback about the partner', async () => {
  renderIt();
  await userEvent.type(screen.getByLabelText(/Note/), 'Thanks for cooking');
  await userEvent.click(screen.getByRole('button', { name: 'Send' }));
  expect(addFeedback).toHaveBeenCalledWith('tidy-otter-maple-4821', '2026-W41', { from: 'a', kind: 'plus', text: 'Thanks for cooking' });
});

test('no warning with a healthy ratio', () => {
  weekFeedback = [fb('plus', 1), fb('plus', 2), fb('minus', 3)];
  renderIt();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('warns when given positives are fewer than twice the negatives', () => {
  weekFeedback = [...Array.from({ length: 9 }, (_, i) => fb('plus', i)), ...Array.from({ length: 5 }, (_, i) => fb('minus', 10 + i))];
  renderIt();
  expect(screen.getByRole('alert')).toHaveTextContent(/destructive/);
});

test('warns while composing a negative that would break the ratio', async () => {
  weekFeedback = [fb('plus', 1), fb('plus', 2), fb('minus', 3)];
  renderIt();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('radio', { name: /Needs work/ }));
  expect(screen.getByRole('alert')).toBeInTheDocument();
});

test('empty note cannot be sent', async () => {
  renderIt();
  expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
});
