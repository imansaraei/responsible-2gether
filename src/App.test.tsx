import { render, screen } from '@testing-library/react';
import App from './App';

test('shows setup instructions when Firebase is not configured', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Responsible 2gether' })).toBeInTheDocument();
  expect(screen.getByText(/Firebase isn’t configured yet/)).toBeInTheDocument();
});
