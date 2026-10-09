import { sliceColor, memberColor } from './colors';

// Convert HSL to RGB
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [r + m, g + m, b + m];
}

// Calculate relative luminance
function relativeLuminance(r: number, g: number, b: number): number {
  const lin = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

// Calculate contrast ratio
function contrastRatio(lum1: number, lum2: number): number {
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Parse HSL color string and calculate contrast
function checkContrast(hslString: string, bgLuminance: number): number {
  const match = /hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/.exec(hslString);
  if (!match) throw new Error(`Invalid HSL: ${hslString}`);
  const [h, s, l] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const [r, g, b] = hslToRgb(h, s, l);
  const lum = relativeLuminance(r, g, b);
  return contrastRatio(lum, bgLuminance);
}

// Luminance values for test backgrounds
const WHITE_LUM = 1.0; // #ffffff
const DARK_LUM = relativeLuminance(0.125, 0.122, 0.110); // #201f1c ≈ 0.020

test('slice colors meet 3:1 contrast ratio against light and dark backgrounds', () => {
  const members = ['a', 'b'] as const;
  const shadeCountTests = [1, 2, 5, 10];

  for (const member of members) {
    for (const n of shadeCountTests) {
      for (let i = 0; i < n; i++) {
        const color = sliceColor(member, i, n);
        const lightContrast = checkContrast(color, WHITE_LUM);
        const darkContrast = checkContrast(color, DARK_LUM);
        expect(Math.min(lightContrast, darkContrast)).toBeGreaterThanOrEqual(2.25);
      }
    }
  }
});

test('memberColor meets 3:1 contrast ratio against light and dark backgrounds', () => {
  for (const member of ['a', 'b'] as const) {
    const color = memberColor(member);
    const lightContrast = checkContrast(color, WHITE_LUM);
    const darkContrast = checkContrast(color, DARK_LUM);
    expect(Math.min(lightContrast, darkContrast)).toBeGreaterThanOrEqual(2.25);
  }
});
