import { readJoinCode } from './Onboarding';

test('readJoinCode extracts and normalises a code from the hash', () => {
  expect(readJoinCode('#join=Tidy-Otter-Maple-4821')).toBe('tidy-otter-maple-4821');
});

test('readJoinCode returns null without a join param', () => {
  expect(readJoinCode('')).toBeNull();
});
