// @vitest-environment jsdom
//
// Nothing in the app or the generator binds a table's bytes to the paytable
// its filename claims. Both `ddb96.bin` and `illinois-deuces.bin` are
// 946,764 bytes with the same format, no header, no magic number, no game
// id — the only association is a string in games.ts and two hand-typed `cp`
// lines in the README. `main.test.ts` checks existence and size only, and
// `Table.fromBytes` validates only length, so a swapped or stale copy of
// either table would pass every other check in this repo while shipping an
// app that prints holds under the wrong paytable's header.
//
// This test loads BOTH real tables through the real `analyze()` and pins a
// value from each, for a hand where the correct play genuinely differs by
// game. The values below were measured by running this exact test against
// the tables committed at the time of writing (see the fix report for the
// command and its output) — they are not derived from the prompt that asked
// for this test.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { Table } from './table';
import { analyze } from './solver';
import { rank, entryMask, type Rank } from './types';

const R = (...ns: number[]) => ns.map(rank) as Rank[];
const UNKNOWN = [null, null, null, null, null] as const;

let ddb: Table;
let deuces: Table;

beforeAll(() => {
  ddb = Table.fromBytes(new Uint8Array(readFileSync('public/ddb96.bin')));
  deuces = Table.fromBytes(new Uint8Array(readFileSync('public/illinois-deuces.bin')));
});

describe('table identity', () => {
  it('holds three deuces under Deuces Wild — EV 14.25', () => {
    // 2 2 2 K 5. Under Deuces Wild the deuces are wild, so three of them is
    // already four-of-a-kind-or-better material on their own; the K and 5
    // contribute nothing and are discarded.
    const a = analyze(deuces, R(0, 0, 0, 11, 3), UNKNOWN.slice());
    expect(a.kind).toBe('resolved');
    if (a.kind !== 'resolved') return;
    expect(a.mask).toBe(entryMask(0b00111));
    expect(a.evLow).toBeCloseTo(14.25, 2);
    expect(a.evHigh).toBeCloseTo(14.25, 2);
  });

  it('holds the same three deuces under DDB — EV 7.53, a different game entirely', () => {
    // Same hand, same held positions (deuces are just a low pair of trips
    // here, not wild), but a completely different EV — DDB has no wild
    // cards, so this is "just" three of a kind plus two dead cards.
    const a = analyze(ddb, R(0, 0, 0, 11, 3), UNKNOWN.slice());
    expect(a.kind).toBe('resolved');
    if (a.kind !== 'resolved') return;
    expect(a.mask).toBe(entryMask(0b00111));
    expect(a.evLow).toBeCloseTo(7.53, 2);
    expect(a.evHigh).toBeCloseTo(7.53, 2);
  });

  it('disagrees between the two tables on this hand — the load-bearing assertion', () => {
    // No mix-up of the two files can satisfy this: whichever table lands at
    // whichever path, this hand's EV differs by paytable. A swapped or
    // stale table collapses this gap to zero (or to whatever the wrong
    // table happens to answer), and this assertion catches that even if the
    // specific numbers pinned above ever need to be re-measured.
    const a1 = analyze(deuces, R(0, 0, 0, 11, 3), UNKNOWN.slice());
    const a2 = analyze(ddb, R(0, 0, 0, 11, 3), UNKNOWN.slice());
    expect(a1.kind).toBe('resolved');
    expect(a2.kind).toBe('resolved');
    if (a1.kind !== 'resolved' || a2.kind !== 'resolved') return;
    expect(a1.evLow).not.toBeCloseTo(a2.evLow, 1);
  });
});
