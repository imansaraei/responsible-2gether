import { WORDS, generateCode, normalizeCode, isValidCode } from './householdCode';

test('word list has 64 unique lowercase words', () => {
  expect(WORDS).toHaveLength(64);
  expect(new Set(WORDS).size).toBe(64);
  WORDS.forEach((w) => expect(w).toMatch(/^[a-z]+$/));
});

test('generateCode uses three words and four digits', () => {
  const seq = [0, 1, 2, 4821];
  let i = 0;
  expect(generateCode(() => seq[i++])).toBe(`${WORDS[0]}-${WORDS[1]}-${WORDS[2]}-4821`);
});

test('generateCode pads digits', () => {
  const seq = [0, 0, 0, 7];
  let i = 0;
  expect(generateCode(() => seq[i++])).toMatch(/-0007$/);
});

test('default generator produces valid codes', () => {
  for (let i = 0; i < 50; i++) expect(isValidCode(generateCode())).toBe(true);
});

test('normalizeCode trims, lowercases and turns spaces into dashes', () => {
  expect(normalizeCode('  Tidy Otter  MAPLE 4821 ')).toBe('tidy-otter-maple-4821');
});

test.each([
  ['tidy-otter-maple-4821', true],
  ['tidy-otter-4821', false],
  ['tidy-otter-maple-482', false],
  ['Tidy-otter-maple-4821', false],
  ['tidy/otter-maple-4821', false],
])('isValidCode(%s) = %s', (s, ok) => expect(isValidCode(s)).toBe(ok));
