import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { Table } from './table';
import { describeBranches } from './branches';
import { analyze } from './solver';
import { rank, type Rank } from './types';

let table: Table;
beforeAll(() => {
  table = Table.fromBytes(new Uint8Array(readFileSync('public/ddb96.bin')));
});

const LABELS = '23456789TJQKA';
const R = (s: string) => [...s].map(c => rank(LABELS.indexOf(c))) as Rank[];
const UNKNOWN = [null, null, null, null, null] as const;
const label = (rs: readonly Rank[]) => rs.map(r => LABELS[r]).join(' ');

describe('describeBranches', () => {
  it('reduces a pair of aces against a royal draw to one question', () => {
    // The dominant shape. Note the condition is existential — "an ace", not a
    // fixed slot — because either ace can be the suited one.
    const b = describeBranches(table, R('AAKQJ'));
    expect(b).not.toBeNull();
    expect(label(b!.conditionRanks)).toBe('A K Q J');
    expect(b!.holdOtherwise).toBe(0b00011);        // both aces, slots 1 and 2
    expect(b!.evIfSuited).toBeCloseTo(18.53, 1);
    expect(b!.evOtherwise).toBeCloseTo(1.92, 1);
  });

  it('reduces a low pair against a three-card royal to one question', () => {
    const b = describeBranches(table, R('QJT22'));
    expect(b).not.toBeNull();
    expect(label(b!.conditionRanks)).toBe('Q J T');
    expect(b!.holdOtherwise).toBe(0b11000);        // the pair, slots 4 and 5
    expect(b!.evIfSuited).toBeCloseTo(1.45, 1);
    expect(b!.evOtherwise).toBeCloseTo(0.88, 1);
  });

  it('declines hands with more than one real decision', () => {
    // K Q J 9 3 has twelve distinct entry-order holds; no single question
    // separates them, so it must fall through to the suit screen.
    expect(analyze(table, R('KQJ93'), UNKNOWN as never).kind).toBe('ambiguous');
    expect(describeBranches(table, R('KQJ93'))).toBeNull();
  });

  it('declines hands that need no question at all', () => {
    expect(analyze(table, R('AAA52'), UNKNOWN as never).kind).toBe('resolved');
    expect(describeBranches(table, R('AAA52'))).toBeNull();
  });

  it('never contradicts the suit screen', () => {
    // Whatever the readout claims must match what entering those suits would
    // have produced. A readout that disagrees with the solver is worse than no
    // readout: the player acts on it.
    for (const hand of ['AAKQJ', 'QJT22', 'KQJ22', 'AA543', '77KQJ', 'AKQ22']) {
      const ranks = R(hand);
      const b = describeBranches(table, ranks);
      if (!b) continue;
      const a = analyze(table, ranks, UNKNOWN as never);
      expect(a.kind, hand).toBe('ambiguous');
      if (a.kind !== 'ambiguous') continue;
      // The "otherwise" hold must be one the solver actually reaches.
      expect(a.masks, hand).toContain(b.holdOtherwise);
      expect(b.evIfSuited, hand).toBeGreaterThan(b.evOtherwise);
    }
  });
});
