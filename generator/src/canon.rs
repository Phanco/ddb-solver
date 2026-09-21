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
}
