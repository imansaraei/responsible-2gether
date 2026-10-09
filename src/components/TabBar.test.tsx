import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabBar } from './TabBar';

test('tabs are in the agreed order with Dashboard in the centre', () => {
  render(<TabBar active="dashboard" onChange={() => {}} />);
  const nav = screen.getByRole('navigation', { name: 'Sections' });
  const labels = within(nav).getAllByRole('button').map((b) => b.textContent);
  expect(labels).toEqual(['Setup', 'Feedback', 'Home', 'To-do', 'Settings']);
  expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('button', { name: 'To-do' })).not.toHaveAttribute('aria-current');
});

test('clicking a tab reports it', async () => {
  const onChange = vi.fn();
  render(<TabBar active="dashboard" onChange={onChange} />);
  await userEvent.click(screen.getByRole('button', { name: 'To-do' }));
  expect(onChange).toHaveBeenCalledWith('todo');
});
