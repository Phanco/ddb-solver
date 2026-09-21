import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { suitPatterns, normalizeSuits, rankMultisetIndex, canonicalize } from './index-fn';
import { slot, rank, type Rank, type Suit } from './types';

describe('suit patterns', () => {
  it('enumerates exactly 51 in lexicographic order', () => {
    const p = suitPatterns();
    expect(p.length).toBe(51);
    expect(p[0]).toEqual([0, 0, 0, 0, 0]);
    for (let i = 1; i < p.length; i++) {
      expect(p[i].join('') > p[i - 1].join('')).toBe(true);
    }
  });

  it('is blind to which concrete suits are used', () => {
    expect(normalizeSuits([2, 2, 3, 1, 1])).toEqual(normalizeSuits([0, 0, 1, 3, 3]));
  });
});

describe('rank multiset index', () => {
  it('is a bijection onto 0..6187', () => {
    const seen = new Set<number>();
    for (let a = 0; a < 13; a++) for (let b = a; b < 13; b++) for (let c = b; c < 13; c++)
      for (let d = c; d < 13; d++) for (let e = d; e < 13; e++) {
        const i = rankMultisetIndex([a, b, c, d, e].map(rank) as Rank[]);
        expect(seen.has(i)).toBe(false);
        seen.add(i);
      }
    expect(seen.size).toBe(6188);
  });
});

describe('cross-language agreement', () => {
  // 134,459 canonicalisations, each scanning 120 permutations and 51 patterns.
  // Well past vitest's 5s default, so give it five minutes explicitly.
  it('reproduces every slot index the Rust generator computed', () => {
    const buf = readFileSync('test-fixtures/canonical-hands.bin');
    expect(buf.length % 9).toBe(0);
    const n = buf.length / 9;
    expect(n).toBe(134_459);

    for (let i = 0; i < n; i++) {
      const o = i * 9;
      const cards = [];
      for (let j = 0; j < 5; j++) {
        const byte = buf[o + j];
        cards.push({ rank: rank(byte >> 2) as Rank, suit: (byte & 3) as Suit });
      }
      const expected = buf.readUInt32LE(o + 5);
      const c = canonicalize(cards);
      if (slot(c.rmi, c.spi) !== expected) {
        // Assert only on mismatch: 134,459 passing expect() calls cost more
        // than the work being tested.
        expect(slot(c.rmi, c.spi), `hand ${i} cards ${JSON.stringify(cards)}`)
          .toBe(expected);
      }
    }
  }, 300_000);
});
