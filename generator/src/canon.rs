use crate::card::*;
use std::sync::OnceLock;

pub const SUIT_PATTERN_COUNT: usize = 51;

fn build_patterns() -> Vec<[u8; 5]> {
    fn rec(i: usize, used: u8, cur: &mut [u8; 5], out: &mut Vec<[u8; 5]>) {
        if i == 5 { out.push(*cur); return; }
        for b in 0..=used {
            if b >= 4 { break; }                    // at most four suits exist
            cur[i] = b;
            rec(i + 1, if b == used { used + 1 } else { used }, cur, out);
        }
    }
    let mut out = Vec::new();
    rec(0, 0, &mut [0u8; 5], &mut out);
    out
}

pub fn suit_patterns() -> &'static [[u8; 5]] {
    static P: OnceLock<Vec<[u8; 5]>> = OnceLock::new();
    P.get_or_init(build_patterns)
}

/// Relabel concrete suits by order of first appearance, so that only the
/// sharing structure survives. Hearts-vs-spades cannot affect any payout.
pub fn normalize_suits(suits: &[Suit; 5]) -> [u8; 5] {
    let mut map = [u8::MAX; 4];
    let mut next = 0u8;
    let mut out = [0u8; 5];
    for i in 0..5 {
        let s = suits[i] as usize;
        if map[s] == u8::MAX { map[s] = next; next += 1; }
        out[i] = map[s];
    }
    out
}

pub fn suit_pattern_index(pattern: &[u8; 5]) -> usize {
    suit_patterns().iter().position(|p| p == pattern)
        .expect("not a valid restricted growth string")
}

pub const RANK_MULTISET_COUNT: usize = 6188;   // C(17,5)

pub fn binom(n: u32, k: u32) -> u32 {
    if k > n { return 0; }
    let k = k.min(n - k);
    let mut r: u64 = 1;
    for i in 0..k as u64 {
        r = r * (n as u64 - i) / (i + 1);
    }
    r as u32
}

/// Lexicographic rank of the 5-subset {c0<c1<...<c4} of {0..16}, where
/// c[i] = sorted_ascending_ranks[i] + i.
pub fn rank_multiset_index(ranks: &[Rank; 5]) -> usize {
    let mut r = *ranks;
    r.sort_unstable();
    let n = 17u32;
    let mut sum = 0u32;
    for i in 0..5u32 {
        let c = r[i as usize] as u32 + i;
        sum += binom(n - 1 - c, 5 - i);
    }
    (binom(n, 5) - 1 - sum) as usize
}

pub const TOTAL_SLOTS: usize = RANK_MULTISET_COUNT * SUIT_PATTERN_COUNT;  // 315_588

pub const fn slot_index(rmi: usize, spi: usize) -> usize {
    rmi * SUIT_PATTERN_COUNT + spi
}

pub struct Canon {
    pub rmi: usize,
    pub spi: usize,
    /// perm[j] is the entry position sitting at canonical position j.
    #[allow(dead_code)] // read by generator/src tests only; not used by the release binary build
    pub perm: [u8; 5],
}

/// All 120 orderings of five positions, generated once.
fn perms5() -> &'static [[u8; 5]] {
    static P: OnceLock<Vec<[u8; 5]>> = OnceLock::new();
    P.get_or_init(|| {
        let mut out = Vec::with_capacity(120);
        let mut cur = [0u8; 5];
        fn rec(used: u8, depth: usize, cur: &mut [u8; 5], out: &mut Vec<[u8; 5]>) {
            if depth == 5 { out.push(*cur); return; }
            for p in 0..5u8 {
                if used & (1 << p) != 0 { continue; }
                cur[depth] = p;
                rec(used | (1 << p), depth + 1, cur, out);
            }
        }
        rec(0, 0, &mut cur, &mut out);
        out
    })
}

/// The 24 permutations of the four suits.
fn perms4() -> &'static [[u8; 4]] {
    static P: OnceLock<Vec<[u8; 4]>> = OnceLock::new();
    P.get_or_init(|| {
        let mut out = Vec::with_capacity(24);
        for a in 0..4u8 { for b in 0..4u8 { for c in 0..4u8 { for d in 0..4u8 {
            let p = [a, b, c, d];
            let mut seen = [false; 4];
            if p.iter().all(|&x| { let f = !seen[x as usize]; seen[x as usize] = true; f }) {
                out.push(p);
            }
        }}}}
        out
    })
}

pub fn canonicalize(cards: &[Card; 5]) -> Canon {
    let mut best: Option<([u8; 5], [u8; 5])> = None;   // (pattern, perm)
    for perm in perms5() {
        // Only orderings that put ranks in descending order are candidates.
        let ranks: [Rank; 5] = core::array::from_fn(|j| cards[perm[j] as usize].rank());
        if !ranks.windows(2).all(|w| w[0] >= w[1]) { continue; }
        let suits: [Suit; 5] = core::array::from_fn(|j| cards[perm[j] as usize].suit());
        let pattern = normalize_suits(&suits);
        match &best {
            Some((bp, _)) if *bp <= pattern => {}
            _ => best = Some((pattern, *perm)),
        }
    }
    let (pattern, perm) = best.expect("some ordering is always rank-descending");
    let ranks: [Rank; 5] = core::array::from_fn(|i| cards[i].rank());
    Canon {
        rmi: rank_multiset_index(&ranks),
        spi: suit_pattern_index(&pattern),
        perm,
    }
}

/// How many concrete hands this canonical hand stands for: 24 suit relabelings
/// divided by the number that leave the hand unchanged.
pub fn orbit_size(cards: &[Card; 5]) -> u32 {
    let mut sorted = *cards;
    sorted.sort_unstable();
    let mut fixers = 0u32;
    for p in perms4() {
        let mut img: [Card; 5] =
            core::array::from_fn(|i| Card::new(cards[i].rank(), p[cards[i].suit() as usize]));
        img.sort_unstable();
        if img == sorted { fixers += 1; }
    }
    24 / fixers
}

/// One representative hand per canonical class, paired with its slot index.
/// Built by walking every (rank multiset, suit pattern) pair, materialising a
/// hand, and keeping it only if it canonicalises back to the pair we started
/// from — which rejects both impossible hands and non-canonical tie orderings.
pub fn canonical_hands() -> Vec<([Card; 5], usize)> {
    let mut out = Vec::with_capacity(134_459);
    for a in 0..13u8 { for b in a..13 { for c in b..13 { for d in c..13 { for e in d..13 {
        // Descending order, matching canonical position order.
        let ranks = [e, d, c, b, a];
        let rmi = rank_multiset_index(&ranks);
        for (spi, pattern) in suit_patterns().iter().enumerate() {
            let hand: [Card; 5] =
                core::array::from_fn(|i| Card::new(ranks[i], pattern[i]));
            // Two cards of the same rank in the same suit block are one card.
            let mut seen = std::collections::HashSet::new();
            if !hand.iter().all(|c| seen.insert(*c)) { continue; }
            let canon = canonicalize(&hand);
            if canon.rmi == rmi && canon.spi == spi {
                out.push((hand, slot_index(rmi, spi)));
            }
        }
    }}}}}
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn there_are_exactly_51_suit_patterns() {
        assert_eq!(suit_patterns().len(), 51);
        assert_eq!(SUIT_PATTERN_COUNT, 51);
    }

    #[test]
    fn patterns_are_lexicographic_and_distinct() {
        let p = suit_patterns();
        for w in p.windows(2) { assert!(w[0] < w[1], "not sorted: {:?} {:?}", w[0], w[1]); }
        assert_eq!(p[0], [0, 0, 0, 0, 0]);          // all one suit
        assert!(p.iter().all(|s| s[0] == 0));        // restricted growth
        assert!(p.iter().all(|s| s.iter().all(|&b| b < 4)));
    }

    #[test]
    fn normalize_is_blind_to_which_suits() {
        // Same sharing structure, different concrete suits -> same pattern.
        assert_eq!(normalize_suits(&[2, 2, 3, 1, 1]), normalize_suits(&[0, 0, 1, 3, 3]));
        assert_eq!(normalize_suits(&[3, 1, 1, 0, 2]), [0, 1, 1, 2, 3]);
    }

    #[test]
    fn index_roundtrips_every_pattern() {
        for (i, p) in suit_patterns().iter().enumerate() {
            assert_eq!(suit_pattern_index(p), i);
        }
    }

    #[test]
    fn rank_multiset_index_is_a_bijection() {
        let mut seen = vec![false; RANK_MULTISET_COUNT];
        let mut n = 0usize;
        for a in 0..13u8 { for b in a..13 { for c in b..13 {
            for d in c..13 { for e in d..13 {
                let i = rank_multiset_index(&[a, b, c, d, e]);
                assert!(i < RANK_MULTISET_COUNT, "index {} out of range", i);
                assert!(!seen[i], "collision at {}", i);
                seen[i] = true;
                n += 1;
            }}}}}
        assert_eq!(n, RANK_MULTISET_COUNT);
        assert!(seen.iter().all(|&s| s), "index space has holes");
    }

    #[test]
    fn rank_multiset_index_ignores_input_order() {
        assert_eq!(
            rank_multiset_index(&[ACE, TWO, JACK, TWO, TEN]),
            rank_multiset_index(&[TWO, TEN, TWO, JACK, ACE])
        );
    }

    #[test]
    fn dead_multisets_sit_at_the_extremes() {
        assert_eq!(rank_multiset_index(&[TWO; 5]), 0);
        assert_eq!(rank_multiset_index(&[ACE; 5]), RANK_MULTISET_COUNT - 1);
    }

    use crate::card::Card;

    fn h(spec: [(Rank, Suit); 5]) -> [Card; 5] {
        let mut out = [Card(0); 5];
        for (i, (r, s)) in spec.into_iter().enumerate() { out[i] = Card::new(r, s); }
        out
    }

    #[test]
    fn relabeling_suits_does_not_change_the_canonical_form() {
        let a = canonicalize(&h([(ACE,0),(11,0),(10,0),(2,1),(5,2)]));
        let b = canonicalize(&h([(ACE,3),(11,3),(10,3),(2,0),(5,1)]));
        assert_eq!((a.rmi, a.spi), (b.rmi, b.spi));
    }

    #[test]
    fn canonical_order_is_rank_descending() {
        let c = canonicalize(&h([(2,0),(ACE,1),(5,2),(JACK,3),(TEN,0)]));
        let src = h([(2,0),(ACE,1),(5,2),(JACK,3),(TEN,0)]);
        let ranks: Vec<Rank> = c.perm.iter().map(|&p| src[p as usize].rank()).collect();
        assert!(ranks.windows(2).all(|w| w[0] >= w[1]), "{:?}", ranks);
    }

    #[test]
    fn there_are_exactly_134459_canonical_hands() {
        assert_eq!(canonical_hands().len(), 134_459);
    }

    /// Primary self-proving check. Every canonical hand stands for an orbit of
    /// concrete hands under the 24 suit relabelings; the orbits partition all
    /// 5-card hands, so the sizes must sum to C(52,5) exactly. A bug in
    /// canonicalization, in the index, or in enumeration moves this number.
    #[test]
    fn orbit_sizes_sum_to_every_possible_hand() {
        let total: u64 = canonical_hands().iter()
            .map(|(hand, _)| orbit_size(hand) as u64)
            .sum();
        assert_eq!(total, 2_598_960);
    }

    #[test]
    fn every_canonical_slot_index_is_distinct_and_in_range() {
        let mut seen = std::collections::HashSet::new();
        for (_, idx) in canonical_hands() {
            assert!(idx < TOTAL_SLOTS);
            assert!(seen.insert(idx), "duplicate slot {}", idx);
        }
    }
}
