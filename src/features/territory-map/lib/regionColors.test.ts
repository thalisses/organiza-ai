import { describe, expect, it } from 'vitest';
import { getRegionColor } from './regionColors';

describe('getRegionColor', () => {
  it('returns a deterministic distinct color for every region in a set of fifty', () => {
    const colors = Array.from({ length: 50 }, (_, index) => getRegionColor(index, 50));

    expect(new Set(colors).size).toBe(50);
    expect(colors.every((color) => /^#[0-9a-f]{6}$/i.test(color))).toBe(true);
    expect(colors).toEqual(Array.from({ length: 50 }, (_, index) => getRegionColor(index, 50)));
  });

  it('rejects a region index outside the configured set', () => {
    expect(() => getRegionColor(3, 3)).toThrow('O índice da região está fora do conjunto configurado.');
  });
});