import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SegmentedPercent } from './SegmentedPercent';

test('five options, current one pressed, click reports value', async () => {
  const onChange = vi.fn();
  render(<SegmentedPercent label="Cooking" value={50} onChange={onChange} />);
  const buttons = screen.getAllByRole('radio');
  expect(buttons.map((b) => b.textContent)).toEqual(['0', '25', '50', '75', '100']);
  expect(screen.getByRole('radio', { name: '50' })).toHaveAttribute('aria-checked', 'true');
  await userEvent.click(screen.getByRole('radio', { name: '100' }));
  expect(onChange).toHaveBeenCalledWith(100);
});
