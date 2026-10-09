import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabBar } from './TabBar';

test('tabs are in the agreed order with Dashboard in the centre', () => {
  render(<TabBar active="dashboard" onChange={() => {}} />);
  const labels = screen.getAllByRole('tab').map((b) => b.textContent);
  expect(labels).toEqual(['Setup', 'Feedback', 'Home', 'To-do', 'Settings']);
  expect(screen.getByRole('tab', { name: 'Home' })).toHaveAttribute('aria-selected', 'true');
});

test('clicking a tab reports it', async () => {
  const onChange = vi.fn();
  render(<TabBar active="dashboard" onChange={onChange} />);
  await userEvent.click(screen.getByRole('tab', { name: 'To-do' }));
  expect(onChange).toHaveBeenCalledWith('todo');
});
