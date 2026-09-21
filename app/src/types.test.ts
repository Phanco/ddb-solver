import { describe, it, expect } from 'vitest';
import { rmi, spi, slot, SUIT_PATTERN_COUNT, RANK_MULTISET_COUNT, TOTAL_SLOTS } from './types';

describe('branded index types', () => {
  it('exposes the same constants as the generator', () => {
    expect(SUIT_PATTERN_COUNT).toBe(51);
    expect(RANK_MULTISET_COUNT).toBe(6188);
    expect(TOTAL_SLOTS).toBe(315_588);
  });

  it('composes a slot index from its two parts', () => {
    expect(slot(rmi(0), spi(0))).toBe(0);
    expect(slot(rmi(1), spi(0))).toBe(51);
    expect(slot(rmi(6187), spi(50))).toBe(315_587);
  });

  it('rejects out-of-range parts', () => {
    expect(() => rmi(6188)).toThrow();
    expect(() => spi(51)).toThrow();
    expect(() => rmi(-1)).toThrow();
  });
});
