import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabBar } from './TabBar';

test('four tabs in order, Home emphasised and current', () => {
  render(<TabBar active="home" onChange={() => {}} />);
  const nav = screen.getByRole('navigation', { name: 'Sections' });
  const buttons = within(nav).getAllByRole('button');
  expect(buttons.map((b) => b.textContent)).toEqual(['Home', 'Chores', 'Money', 'Settings']);
  expect(buttons[0]).toHaveAttribute('aria-current', 'page');
  expect(buttons[0]).toHaveClass('tab-center');
  expect(buttons[1]).not.toHaveAttribute('aria-current');
});

test('clicking a tab reports it', async () => {
  const onChange = vi.fn();
  render(<TabBar active="home" onChange={onChange} />);
  await userEvent.click(screen.getByRole('button', { name: 'Money' }));
  expect(onChange).toHaveBeenCalledWith('money');
});
