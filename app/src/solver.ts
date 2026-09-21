import { canonicalize, suitPatterns } from './index-fn';
import type { Table } from './table';
import { entryMask, slot, type EntryMask, type Rank, type Suit } from './types';

export type Analysis =
  | { kind: 'resolved'; mask: EntryMask; evLow: number; evHigh: number }
  | { kind: 'ambiguous'; masks: EntryMask[]; relevant: boolean[] };

interface Candidate { pattern: number[]; mask: EntryMask; ev: number }

/** Patterns consistent with the ranks and with whatever suits are known. */
function candidates(table: Table, ranks: readonly Rank[], known: readonly (Suit | null)[]): Candidate[] {
  const out: Candidate[] = [];
  for (const pattern of suitPatterns()) {
    // Two cards of the same rank in one suit block would be the same card.
    let ok = true;
    for (let i = 0; i < 5 && ok; i++) {
      for (let j = i + 1; j < 5; j++) {
        if (ranks[i] === ranks[j] && pattern[i] === pattern[j]) { ok = false; break; }
      }
    }
    if (!ok) continue;

    // Known suits constrain sharing: two known cards share a block exactly
    // when they share a suit. Which block is irrelevant — blocks are unlabelled.
    for (let i = 0; i < 5 && ok; i++) {
      if (known[i] === null) continue;
      for (let j = i + 1; j < 5; j++) {
        if (known[j] === null) continue;
        if ((pattern[i] === pattern[j]) !== (known[i] === known[j])) { ok = false; break; }
      }
    }
    if (!ok) continue;

    const cards = ranks.map((r, i) => ({ rank: r, suit: pattern[i] as Suit }));
    const c = canonicalize(cards);
    const hit = table.lookup(slot(c.rmi, c.spi));
    if (!hit) continue;

    // Canonical mask -> entry-order mask. perm[j] is the entry position
    // sitting at canonical position j.
    let m = 0;
    for (let j = 0; j < 5; j++) {
      if (hit.mask & (1 << j)) m |= 1 << c.perm[j];
    }
    out.push({ pattern, mask: entryMask(m), ev: hit.ev });
  }
  return out;
}

/** Key of a pattern with position `skip` removed, renormalised. */
function withoutPosition(pattern: readonly number[], skip: number): string {
  const map = new Map<number, number>();
  const parts: number[] = [];
  for (let i = 0; i < 5; i++) {
    if (i === skip) continue;
    let b = map.get(pattern[i]);
    if (b === undefined) { b = map.size; map.set(pattern[i], b); }
    parts.push(b);
  }
  return parts.join('');
}

export function analyze(
  table: Table,
  ranks: readonly Rank[],
  known: readonly (Suit | null)[],
): Analysis {
  const cands = candidates(table, ranks, known);
  if (cands.length === 0) throw new Error('no suit arrangement fits these cards');

  const masks = [...new Set(cands.map(c => c.mask))];
  if (masks.length === 1) {
    const evs = cands.map(c => c.ev);
    return { kind: 'resolved', mask: masks[0], evLow: Math.min(...evs), evHigh: Math.max(...evs) };
  }

  // A position matters if two candidates agreeing everywhere else disagree
  // on the answer. Anything else is a question not worth asking.
  const relevant = [0, 1, 2, 3, 4].map(i => {
    if (known[i] !== null) return false;
    const groups = new Map<string, Set<number>>();
    for (const c of cands) {
      const key = withoutPosition(c.pattern, i);
      const g = groups.get(key) ?? new Set<number>();
      g.add(c.mask);
      groups.set(key, g);
    }
    return [...groups.values()].some(g => g.size > 1);
  });

  return { kind: 'ambiguous', masks, relevant };
}
