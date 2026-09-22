import { canonicalize, suitPatterns } from './index-fn';
import type { Table } from './table';
import { entryMask, slot, type EntryMask, type Rank, type Suit } from './types';

/**
 * A hand whose play reduces to one yes/no question about suits.
 *
 * `conditionRanks` are the ranks that must share a suit. The question is
 * existential, not positional: for `A A K Q J` the rule is "K, Q, J and an ace",
 * and which ace it is varies by deal. That is why `holdIfSuited` is absent —
 * the instruction is "hold those", and the player can see which ace is the
 * heart far faster than we can name a slot.
 */
export interface Branches {
  conditionRanks: Rank[];
  evIfSuited: number;
  /** Entry-order positions to hold when the condition does NOT hold. */
  holdOtherwise: EntryMask;
  evOtherwise: number;
}

interface Candidate {
  pattern: readonly number[];
  canonicalMask: number;
  entry: number;
  ev: number;
}

function candidates(table: Table, ranks: readonly Rank[]): Candidate[] {
  const out: Candidate[] = [];
  for (const pattern of suitPatterns()) {
    let ok = true;
    for (let i = 0; i < 5 && ok; i++) {
      for (let j = i + 1; j < 5; j++) {
        if (ranks[i] === ranks[j] && pattern[i] === pattern[j]) { ok = false; break; }
      }
    }
    if (!ok) continue;
    const c = canonicalize(ranks.map((r, i) => ({ rank: r, suit: pattern[i] as Suit })));
    const hit = table.lookup(slot(c.rmi, c.spi));
    if (!hit) continue;
    let entry = 0;
    for (let j = 0; j < 5; j++) if (hit.mask & (1 << j)) entry |= 1 << c.perm[j];
    out.push({ pattern, canonicalMask: hit.mask, entry, ev: hit.ev });
  }
  return out;
}

/** Can one position per rank in `want` be chosen so they all share a suit? */
function someSelectionShares(
  pattern: readonly number[],
  ranks: readonly Rank[],
  want: readonly Rank[],
): boolean {
  const choices = want.map(r => [0, 1, 2, 3, 4].filter(i => ranks[i] === r));
  const used: number[] = [];
  const walk = (k: number, block: number): boolean => {
    if (k === choices.length) return true;
    for (const i of choices[k]) {
      if (used.includes(i)) continue;
      if (block !== -1 && pattern[i] !== block) continue;
      used.push(i);
      if (walk(k + 1, block === -1 ? pattern[i] : block)) return true;
      used.pop();
    }
    return false;
  };
  return walk(0, -1);
}

function subsetsDescending(values: Rank[], size: number): Rank[][] {
  const out: Rank[][] = [];
  const walk = (start: number, acc: Rank[]) => {
    if (acc.length === size) { out.push([...acc]); return; }
    for (let i = start; i < values.length; i++) {
      acc.push(values[i]);
      walk(i + 1, acc);
      acc.pop();
    }
  };
  walk(0, []);
  return out;
}

/**
 * Describe a hand as a single suited-or-not question, or return null when it
 * cannot be put that way and the suit screen should be used instead.
 *
 * Grouping is by CANONICAL mask, not entry-order mask, and that distinction is
 * load-bearing. `A A K Q J` has three distinct entry-order masks but only two
 * decisions: hold the four-card royal, or hold the pair. The two royal masks
 * differ only in which interchangeable ace carries it. Canonical order collapses
 * exactly that duplication, which is the grouping a readout needs.
 */
export function describeBranches(table: Table, ranks: readonly Rank[]): Branches | null {
  const cands = candidates(table, ranks);
  if (cands.length === 0) return null;

  const byCanonical = new Map<number, Candidate[]>();
  for (const c of cands) {
    const g = byCanonical.get(c.canonicalMask) ?? [];
    g.push(c);
    byCanonical.set(c.canonicalMask, g);
  }
  if (byCanonical.size !== 2) return null;

  const groups = [...byCanonical.values()].sort((a, b) => a.length - b.length);
  const [minority, majority] = groups;

  // The "otherwise" branch names slots, so every deal in it must hold the same
  // slots. Grouping by canonical mask could in principle hide a difference here.
  const otherwise = majority[0].entry;
  if (majority.some(c => c.entry !== otherwise)) return null;

  const distinct = [...new Set(ranks)].sort((a, b) => b - a);
  const minoritySet = new Set(minority.map(c => c.pattern));

  for (let size = 2; size <= distinct.length; size++) {
    for (const want of subsetsDescending(distinct, size)) {
      let matches = true;
      for (const c of cands) {
        const shares = someSelectionShares(c.pattern, ranks, want);
        if (shares !== minoritySet.has(c.pattern)) { matches = false; break; }
      }
      if (!matches) continue;

      // Only claim "hold those" when the held cards really are the condition
      // cards. Anything else would need a instruction we cannot phrase without
      // naming slots that move between deals.
      const wantCounts = new Map<Rank, number>();
      for (const r of want) wantCounts.set(r, (wantCounts.get(r) ?? 0) + 1);
      const heldMatchesCondition = minority.every(c => {
        const heldCounts = new Map<Rank, number>();
        for (let i = 0; i < 5; i++) {
          if (c.entry & (1 << i)) {
            heldCounts.set(ranks[i], (heldCounts.get(ranks[i]) ?? 0) + 1);
          }
        }
        if (heldCounts.size !== wantCounts.size) return false;
        for (const [r, n] of wantCounts) if (heldCounts.get(r) !== n) return false;
        return true;
      });
      if (!heldMatchesCondition) return null;

      return {
        conditionRanks: want,
        evIfSuited: Math.min(...minority.map(c => c.ev)),
        holdOtherwise: entryMask(otherwise),
        evOtherwise: Math.min(...majority.map(c => c.ev)),
      };
    }
  }
  return null;
}
