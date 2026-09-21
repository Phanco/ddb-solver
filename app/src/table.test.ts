import { describe, it, expect } from 'vitest';
import { Table } from './table';
import { TOTAL_SLOTS, type SlotIndex } from './types';

function bytesWith(entries: Array<[number, number, number]>): Uint8Array {
  const b = new Uint8Array(TOTAL_SLOTS * 3);
  for (const [idx, mask, evUnits] of entries) {
    b[idx * 3] = mask | 0x80;
    b[idx * 3 + 1] = evUnits & 0xff;
    b[idx * 3 + 2] = (evUnits >> 8) & 0xff;
  }
  return b;
}

describe('Table', () => {
  it('decodes an occupied slot', () => {
    const t = Table.fromBytes(bytesWith([[7, 0b10110, 64 * 3]]));
    expect(t.lookup(7 as SlotIndex)).toEqual({ mask: 0b10110, ev: 3 });
  });

  it('returns null for an unoccupied slot', () => {
    const t = Table.fromBytes(bytesWith([[7, 0b10110, 64]]));
    expect(t.lookup(8 as SlotIndex)).toBeNull();
  });

  it('decodes a pat royal at the top of the EV range', () => {
    const t = Table.fromBytes(bytesWith([[0, 0b11111, 800 * 64]]));
    expect(t.lookup(0 as SlotIndex)!.ev).toBe(800);
  });

  it('rejects a file of the wrong size', () => {
    expect(() => Table.fromBytes(new Uint8Array(10))).toThrow(/size/i);
  });
});
