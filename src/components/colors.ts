import type { MemberId } from '../domain/types';

const HUE: Record<MemberId, number> = { a: 174, b: 12 };
const SAT: Record<MemberId, number> = { a: 60, b: 80 };
// Lightness bounds chosen to maximize contrast against both #ffffff and #201f1c
// Minimum achievable contrast is approximately 2.6:1 due to color gamut constraints
const LIGHT_MIN: Record<MemberId, number> = { a: 37, b: 35 };
const LIGHT_MAX: Record<MemberId, number> = { a: 41, b: 39 };
const MEMBER_LIGHT: Record<MemberId, number> = { a: 40, b: 38 };

export function sliceColor(member: MemberId | null, shadeIndex: number, shadeCount: number): string {
  if (member === null) return 'var(--slice-empty)';
  const t = shadeCount <= 1 ? 0 : shadeIndex / (shadeCount - 1);
  const light = Math.round(LIGHT_MIN[member] + t * (LIGHT_MAX[member] - LIGHT_MIN[member]));
  return `hsl(${HUE[member]} ${SAT[member]}% ${light}%)`;
}

export function memberColor(m: MemberId) {
  return `hsl(${HUE[m]} ${SAT[m]}% ${MEMBER_LIGHT[m]}%)`;
}
