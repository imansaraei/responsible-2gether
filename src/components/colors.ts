import type { MemberId } from '../domain/types';

const HUE: Record<MemberId, number> = { a: 174, b: 12 };
const SAT: Record<MemberId, number> = { a: 60, b: 80 };

export function sliceColor(member: MemberId | null, shadeIndex: number, shadeCount: number): string {
  if (member === null) return 'var(--slice-empty)';
  const t = shadeCount <= 1 ? 0 : shadeIndex / (shadeCount - 1);
  const light = Math.round(34 + t * 36); // 34% → 70%
  return `hsl(${HUE[member]} ${SAT[member]}% ${light}%)`;
}

export const memberColor = (m: MemberId) => sliceColor(m, 0, 3).replace(/ 34%\)$/, ' 42%)');
