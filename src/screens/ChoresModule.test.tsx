import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChoresModule } from './ChoresModule';

vi.mock('./Dashboard', () => ({ Dashboard: () => <p>week screen</p> }));
vi.mock('./Todo', () => ({ Todo: () => <p>todo screen</p> }));
vi.mock('./Feedback', () => ({ Feedback: () => <p>feedback screen</p> }));
vi.mock('./Config', () => ({ Config: () => <p>setup screen</p> }));

test('shows the Tidy Together title and the four sections in order', () => {
  render(<ChoresModule section="week" onSection={() => {}} />);
  expect(screen.getByRole('heading', { name: /Tidy Together/ })).toBeInTheDocument();
  const tabs = screen.getAllByRole('tab');
  expect(tabs.map((t) => t.textContent)).toEqual(['This week', 'To-do', 'Feedback', 'Setup']);
  expect(screen.getByRole('tab', { name: 'This week' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByText('week screen')).toBeInTheDocument();
  expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1']);
});

test('renders the requested section', () => {
  render(<ChoresModule section="todo" onSection={() => {}} />);
  expect(screen.getByText('todo screen')).toBeInTheDocument();
  expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'chores-tab-todo');
});

test('choosing a section reports it', async () => {
  const onSection = vi.fn();
  render(<ChoresModule section="week" onSection={onSection} />);
  await userEvent.click(screen.getByRole('tab', { name: 'Feedback' }));
  expect(onSection).toHaveBeenCalledWith('feedback');
});

test('arrow keys move between sections', async () => {
  const onSection = vi.fn();
  render(<ChoresModule section="week" onSection={onSection} />);
  screen.getByRole('tab', { name: 'This week' }).focus();
  await userEvent.keyboard('{ArrowRight}');
  expect(onSection).toHaveBeenCalledWith('todo');
  await userEvent.keyboard('{ArrowLeft}');
  expect(onSection).toHaveBeenLastCalledWith('setup');
});

test('Home and End jump to the first and last section', async () => {
  const onSection = vi.fn();
  render(<ChoresModule section="todo" onSection={onSection} />);
  screen.getByRole('tab', { name: 'To-do' }).focus();
  await userEvent.keyboard('{Home}');
  expect(onSection).toHaveBeenLastCalledWith('week');
  await userEvent.keyboard('{End}');
  expect(onSection).toHaveBeenLastCalledWith('setup');
});
