import {
  rmi, spi,
  type Rank, type Suit, type RankMultisetIndex, type SuitPatternIndex,
} from './types';

/** Restricted growth strings of length 5 over at most 4 blocks, lexicographic. */
let PATTERNS: number[][] | null = null;
export function suitPatterns(): readonly number[][] {
  if (PATTERNS) return PATTERNS;
  const out: number[][] = [];
  const cur = [0, 0, 0, 0, 0];
  (function rec(i: number, used: number) {
    if (i === 5) { out.push([...cur]); return; }
    for (let b = 0; b <= used && b < 4; b++) {
      cur[i] = b;
      rec(i + 1, b === used ? used + 1 : used);
    }
  })(0, 0);
  PATTERNS = out;
  return out;
}

/** Relabel suits by order of first appearance. */
export function normalizeSuits(suits: readonly Suit[]): number[] {
  const map = new Map<number, number>();
  return suits.map(s => {
    let b = map.get(s);
    if (b === undefined) { b = map.size; map.set(s, b); }
    return b;
  });
}

export function suitPatternIndex(pattern: readonly number[]): SuitPatternIndex {
  const key = pattern.join('');
  const i = suitPatterns().findIndex(p => p.join('') === key);
  if (i < 0) throw new Error(`not a restricted growth string: ${key}`);
  return spi(i);
}

function binom(n: number, k: number): number {
  if (k > n || n < 0 || k < 0) return 0;
  k = Math.min(k, n - k);
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return Math.round(r);
}

export function rankMultisetIndex(ranks: readonly Rank[]): RankMultisetIndex {
  const r = [...ranks].sort((a, b) => a - b);
  let sum = 0;
  for (let i = 0; i < 5; i++) sum += binom(17 - 1 - (r[i] + i), 5 - i);
  return rmi(binom(17, 5) - 1 - sum);
}

const PERMS5: number[][] = (() => {
  const out: number[][] = [];
  const cur = [0, 0, 0, 0, 0];
  (function rec(used: number, depth: number) {
    if (depth === 5) { out.push([...cur]); return; }
    for (let p = 0; p < 5; p++) {
      if (used & (1 << p)) continue;
      cur[depth] = p;
      rec(used | (1 << p), depth + 1);
    }
  })(0, 0);
  return out;
})();

export interface Canon {
  rmi: RankMultisetIndex;
  spi: SuitPatternIndex;
  /** perm[j] is the ENTRY position sitting at canonical position j. */
  perm: number[];
}

export function canonicalize(cards: readonly { rank: Rank; suit: Suit }[]): Canon {
  let bestPattern: string | null = null;
  let bestPerm: number[] = [];
  for (const perm of PERMS5) {
    let descending = true;
    for (let j = 1; j < 5; j++) {
      if (cards[perm[j - 1]].rank < cards[perm[j]].rank) { descending = false; break; }
    }
    if (!descending) continue;
    const pattern = normalizeSuits(perm.map(p => cards[p].suit)).join('');
    if (bestPattern === null || pattern < bestPattern) {
      bestPattern = pattern;
      bestPerm = perm;
    }
  }
  if (bestPattern === null) throw new Error('no rank-descending ordering');
  return {
    rmi: rankMultisetIndex(cards.map(c => c.rank)),
    spi: suitPatternIndex(bestPattern.split('').map(Number)),
    perm: bestPerm,
  };
}
