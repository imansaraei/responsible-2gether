import { render } from '@testing-library/react';
import { Donut } from './Donut';
import { sliceColor } from './colors';

test('one arc per slice with dash length proportional to value', () => {
  const { container } = render(
    <Donut ariaLabel="test" label="x" slices={[
      { key: 'a1', label: 'Cooking', value: 3, member: 'a', shadeIndex: 0, shadeCount: 1 },
      { key: 'notdone', label: 'Not done yet', value: 1, member: null, shadeIndex: 0, shadeCount: 1 },
    ]} />,
  );
  const arcs = container.querySelectorAll('circle[data-slice]');
  expect(arcs).toHaveLength(2);
  const len = (el: Element) => Number(el.getAttribute('stroke-dasharray')!.split(' ')[0]);
  // With 2px gap between arcs, dash length is reduced by GAP for multi-slice charts
  // Compare total arc lengths: len(a1) ≈ 3*circumference/4 - 2, len(notdone) ≈ circumference/4 - 2
  expect((len(arcs[0]) + 2) / (len(arcs[1]) + 2)).toBeCloseTo(3);
  expect(arcs[0].querySelector('title')!.textContent).toBe('Cooking — 3 h');
});

test('empty chart draws a single empty ring', () => {
  const { container } = render(<Donut ariaLabel="test" label="x" slices={[]} />);
  expect(container.querySelectorAll('circle[data-slice]')).toHaveLength(0);
  expect(container.querySelector('circle.donut-track')).not.toBeNull();
});

test('shades stay within the member hue and get lighter', () => {
  expect(sliceColor('a', 0, 3)).toMatch(/^hsl\(174 /);
  expect(sliceColor('b', 2, 3)).toMatch(/^hsl\(12 /);
  expect(sliceColor(null, 0, 1)).toBe('var(--slice-empty)');
  const light = (c: string) => Number(/ (\d+)%\)$/.exec(c)![1]);
  expect(light(sliceColor('a', 2, 3))).toBeGreaterThan(light(sliceColor('a', 0, 3)));
});

test('each arc dash plus gap equals the circumference (no seam)', () => {
  const { container } = render(
    <Donut ariaLabel="test" label="x" slices={[
      { key: 'a1', label: 'Cooking', value: 3, member: 'a', shadeIndex: 0, shadeCount: 1 },
      { key: 'b1', label: 'Trash', value: 2, member: 'b', shadeIndex: 0, shadeCount: 1 },
      { key: 'notdone', label: 'Not done yet', value: 1, member: null, shadeIndex: 0, shadeCount: 1 },
    ]} />,
  );
  const C = 2 * Math.PI * ((240 - 38) / 2);
  const arcs = [...container.querySelectorAll('circle[data-slice]')];
  expect(arcs).toHaveLength(3);
  for (const a of arcs) {
    const [dash, gap] = a.getAttribute('stroke-dasharray')!.split(' ').map(Number);
    expect(dash + gap).toBeCloseTo(C, 6);
  }
});
