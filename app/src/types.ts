export const SUIT_PATTERN_COUNT = 51;
export const RANK_MULTISET_COUNT = 6188;
export const TOTAL_SLOTS = RANK_MULTISET_COUNT * SUIT_PATTERN_COUNT;

/** 0 = Two … 8 = Ten, 9 = Jack, 10 = Queen, 11 = King, 12 = Ace. */
export type Rank = number & { readonly __brand: 'Rank' };
export type Suit = 0 | 1 | 2 | 3;

export type RankMultisetIndex = number & { readonly __brand: 'RankMultisetIndex' };
export type SuitPatternIndex  = number & { readonly __brand: 'SuitPatternIndex' };
export type SlotIndex         = number & { readonly __brand: 'SlotIndex' };
/** Bits 0-4, one per position in CANONICAL rank-descending order. */
export type HoldMask          = number & { readonly __brand: 'HoldMask' };
/** Bits 0-4, one per position in the order the user entered the cards. */
export type EntryMask         = number & { readonly __brand: 'EntryMask' };

function checked(n: number, limit: number, what: string): number {
  if (!Number.isInteger(n) || n < 0 || n >= limit) {
    throw new RangeError(`${what} out of range: ${n}`);
  }
  return n;
}

export const rank = (n: number) => checked(n, 13, 'rank') as Rank;
export const rmi  = (n: number) => checked(n, RANK_MULTISET_COUNT, 'rankMultisetIndex') as RankMultisetIndex;
export const spi  = (n: number) => checked(n, SUIT_PATTERN_COUNT, 'suitPatternIndex') as SuitPatternIndex;
export const holdMask  = (n: number) => checked(n, 32, 'holdMask') as HoldMask;
export const entryMask = (n: number) => checked(n, 32, 'entryMask') as EntryMask;

export const slot = (r: RankMultisetIndex, s: SuitPatternIndex): SlotIndex =>
  (r * SUIT_PATTERN_COUNT + s) as SlotIndex;
