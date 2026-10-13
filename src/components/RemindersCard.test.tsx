import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RemindersCard } from './RemindersCard';
import * as reminders from '../push/reminders';

vi.mock('../push/reminders', () => ({
  reminderSupport: vi.fn(() => 'supported'),
  getReminderState: vi.fn(async () => 'off'),
  enableReminders: vi.fn(async () => 'on'),
  disableReminders: vi.fn(async () => 'off'),
}));
const m = vi.mocked(reminders);

afterEach(() => vi.clearAllMocks());

test('shows the Persian reminder text and times', () => {
  render(<RemindersCard />);
  expect(screen.getByText(/10:00 and 22:00/)).toBeInTheDocument();
  expect(screen.getByText('«کارهای امروز رو ثبت کردی؟»')).toHaveAttribute('dir', 'rtl');
});

test('turning on calls enable and flips the switch', async () => {
  render(<RemindersCard />);
  const sw = await screen.findByRole('switch', { name: 'Turn on daily reminders' });
  await userEvent.click(sw);
  expect(m.enableReminders).toHaveBeenCalled();
  expect(await screen.findByRole('switch', { name: /on — turn off/ })).toHaveAttribute('aria-checked', 'true');
});

test('turning off calls disable', async () => {
  m.getReminderState.mockResolvedValueOnce('on');
  render(<RemindersCard />);
  await userEvent.click(await screen.findByRole('switch', { name: /turn off/ }));
  expect(m.disableReminders).toHaveBeenCalled();
});

test('iPhone in Safari is told to install first, with no switch', () => {
  m.reminderSupport.mockReturnValueOnce('needs-install');
  render(<RemindersCard />);
  expect(screen.getByText(/add the app to your Home Screen first/)).toBeInTheDocument();
  expect(screen.queryByRole('switch')).toBeNull();
});

test('blocked permission explains how to fix it', async () => {
  m.getReminderState.mockResolvedValueOnce('blocked');
  render(<RemindersCard />);
  expect(await screen.findByText(/Notifications are blocked/)).toBeInTheDocument();
  expect(screen.queryByRole('switch')).toBeNull();
});

test('a failure shows an error and keeps the previous state', async () => {
  m.enableReminders.mockRejectedValueOnce(new Error('offline'));
  render(<RemindersCard />);
  await userEvent.click(await screen.findByRole('switch'));
  expect(await screen.findByRole('alert')).toHaveTextContent(/Couldn’t update reminders/);
  expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
});
