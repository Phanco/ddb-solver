import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { Table } from './table';
import { analyze, type Analysis } from './solver';
import { suitPatterns } from './index-fn';
import { rank, type Rank, type Suit } from './types';

let table: Table;
beforeAll(() => {
  table = Table.fromBytes(new Uint8Array(readFileSync('public/ddb96.bin')));
});

const R = (...ns: number[]) => ns.map(rank) as Rank[];
const UNKNOWN: (Suit | null)[] = [null, null, null, null, null];

describe('analyze', () => {
  it('resolves three aces without asking about suits', () => {
    // A A A 5 2 — trips plus a low kicker; no suit arrangement changes the play.
    const a = analyze(table, R(12, 12, 12, 3, 0), UNKNOWN);
    expect(a.kind).toBe('resolved');
  });

  it('cannot resolve K Q J 9 3 from ranks alone', () => {
    // Suits decide between a three-card royal and a plain high-card hold.
    const a = analyze(table, R(11, 10, 9, 7, 1), UNKNOWN);
    expect(a.kind).toBe('ambiguous');
  });

  it('routes 7 7 K Q J to disambiguation because a hold can split the pair', () => {
    const a = analyze(table, R(5, 5, 11, 10, 9), UNKNOWN);
    expect(a.kind).toBe('ambiguous');
  });

  it('resolves once enough suits are known', () => {
    // All five one suit: a made flush, and nothing is left to ask.
    const a = analyze(table, R(11, 10, 9, 7, 1), [0, 0, 0, 0, 0]);
    expect(a.kind).toBe('resolved');
  });

  it('reports masks in entry order, permuting with the entry order', () => {
    const straight  = analyze(table, R(12, 11, 10, 9, 8), [0, 1, 2, 3, 0]);
    const shuffled  = analyze(table, R(8, 12, 9, 11, 10), [0, 0, 3, 1, 2]);
    expect(straight.kind).toBe('resolved');
    expect(shuffled.kind).toBe('resolved');
    if (straight.kind !== 'resolved' || shuffled.kind !== 'resolved') return;
    // Same five cards, different slots: both hold everything (a made straight).
    expect(straight.mask).toBe(0b11111);
    expect(shuffled.mask).toBe(0b11111);
    expect(straight.evLow).toBeCloseTo(shuffled.evLow, 6);
  });

  it('agrees with itself: a rank-only verdict survives every suit assignment', () => {
    // The central claim of the app. If the rank-only pass says "resolved",
    // then fixing ANY concrete suits must yield the same hold. A classifier
    // that under-asks would give a confidently wrong hold; this catches it.
    const RANK_SETS = [
      R(12, 12, 12, 3, 0),   // three aces + low kicker
      R(12, 12, 5, 5, 8),    // aces up
      R(1, 3, 6, 9, 11),     // scattered junk
      R(4, 4, 4, 4, 12),     // quads
      R(10, 10, 2, 2, 7),    // two pair
    ];
    for (const ranks of RANK_SETS) {
      const first = analyze(table, ranks, UNKNOWN);
      if (first.kind !== 'resolved') continue;
      for (const pattern of suitPatterns()) {
        const suits = pattern as unknown as Suit[];
        let concrete: Analysis;
        try { concrete = analyze(table, ranks, suits); } catch { continue; }
        expect(concrete.kind, `${ranks} / ${pattern}`).toBe('resolved');
        if (concrete.kind !== 'resolved') continue;
        expect(concrete.mask, `${ranks} / ${pattern}`).toBe(first.mask);
      }
    }
  });

  it('drops the kicker with three aces and draws two', () => {
    // A A A 2 9. Holding the deuce for the 400-per-coin low-kicker quad row
    // loses to drawing two, which nearly doubles the chance of the fourth ace:
    // 556/47 = 11.830 with the kicker against 13501/1081 = 12.489 without.
    // Verified against the Rust solver in Task 7, not from published strategy.
    const a = analyze(table, R(12, 12, 12, 0, 7), UNKNOWN);
    expect(a.kind).toBe('resolved');
    if (a.kind !== 'resolved') return;
    expect(a.mask & 0b00111).toBe(0b00111);   // all three aces held
    expect(a.mask & 0b01000).toBe(0);         // kicker discarded
  });
});
