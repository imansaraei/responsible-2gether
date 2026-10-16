import { act, renderHook } from '@testing-library/react';
import { useToast } from './Toast';

test('showing the same message twice restarts the 4s timer', () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useToast());
  act(() => result.current.show('Saved'));
  act(() => { vi.advanceTimersByTime(3000); });
  act(() => result.current.show('Saved'));
  act(() => { vi.advanceTimersByTime(3000); });
  expect(result.current.toast).toBe('Saved');
  act(() => { vi.advanceTimersByTime(1100); });
  expect(result.current.toast).toBeNull();
  vi.useRealTimers();
});
