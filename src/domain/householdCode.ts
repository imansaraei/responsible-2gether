export const WORDS = [
  'apple', 'amber', 'basil', 'berry', 'birch', 'brook', 'cedar', 'cherry',
  'clover', 'coral', 'cotton', 'daisy', 'dune', 'ember', 'fern', 'fig',
  'finch', 'flint', 'frost', 'gecko', 'ginger', 'harbor', 'hazel', 'heron',
  'honey', 'iris', 'ivy', 'jade', 'juniper', 'kiwi', 'lark', 'lemon',
  'lilac', 'linen', 'lotus', 'maple', 'meadow', 'mint', 'moss', 'nectar',
  'olive', 'orchid', 'otter', 'pebble', 'pepper', 'pine', 'plum', 'poppy',
  'quartz', 'raven', 'reed', 'river', 'robin', 'sage', 'sparrow', 'spruce',
  'tidy', 'tulip', 'velvet', 'willow', 'wren', 'yarrow', 'zinnia', 'cocoa',
];

const cryptoInt = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0] % n;

export function generateCode(randomInt: (n: number) => number = cryptoInt): string {
  const words = [0, 1, 2].map(() => WORDS[randomInt(WORDS.length)]);
  const digits = String(randomInt(10_000)).padStart(4, '0');
  return [...words, digits].join('-');
}

export const normalizeCode = (input: string) =>
  input.trim().toLowerCase().split(/[\s-]+/).filter(Boolean).join('-');

export const isValidCode = (s: string) => /^[a-z]+-[a-z]+-[a-z]+-[0-9]{4}$/.test(s);
