import { render, screen } from '@testing-library/react';
import { OfflinePill } from './OfflinePill';

let status = 'offline';
vi.mock('../firebase/hooks', () => ({ useSyncStatus: () => status }));

test('shows a status pill when offline', () => {
  status = 'offline';
  render(<OfflinePill code="x" />);
  expect(screen.getByRole('status')).toHaveTextContent('Offline — changes will sync');
});

test.each(['synced', 'saving'])('renders nothing when %s', (s) => {
  status = s;
  const { container } = render(<OfflinePill code="x" />);
  expect(container).toBeEmptyDOMElement();
});
