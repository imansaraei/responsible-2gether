import { render, screen } from '@testing-library/react';
import App from './App';

vi.mock('./firebase/config', () => ({ isConfigured: false }));

test('shows setup instructions when Firebase is not configured', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Khooneh' })).toBeInTheDocument();
  expect(screen.getByText(/Firebase isn’t configured yet/)).toBeInTheDocument();
});
