use crate::card::*;
use crate::eval::deuces::{Category, ROYAL_WINDOW, STRAIGHT_WINDOWS};

/// Classify taking every card at face value — no card is wild here. Recognises
/// five of a kind, which a real deck cannot produce but a wild substitution can.
#[allow(dead_code)] // used by generator/src tests as the differential reference evaluator
fn natural_category(cards: &[Card; 5]) -> Category {
    let mut counts = [0u8; 13];
    let mut suits = 0u8;
    let mut present = 0u16;
    for c in cards {
        counts[c.rank() as usize] += 1;
        suits |= 1 << c.suit();
        present |= 1 << c.rank();
    }
    let flush = suits.count_ones() == 1;
    let distinct = present.count_ones() == 5;
    let straight = distinct && STRAIGHT_WINDOWS.iter().any(|m| (present & !m) == 0);
    let royal = distinct && (present & !ROYAL_WINDOW) == 0;

    let mut sorted = counts;
    sorted.sort_unstable_by(|a, b| b.cmp(a));
    let (c1, c2) = (sorted[0], sorted[1]);

    if flush && royal { return Category::NaturalRoyal; }
    if c1 == 5 { return Category::FiveOfAKind; }
    if flush && straight { return Category::StraightFlush; }
    if c1 == 4 { return Category::FourOfAKind; }
    if c1 == 3 && c2 == 2 { return Category::FullHouse; }
    if flush { return Category::Flush; }
    if straight { return Category::Straight; }
    if c1 == 3 { return Category::ThreeOfAKind; }
    Category::Nothing
}

/// Classify by trying every substitution for the wilds and keeping the best.
///
/// Substitution ranges over all 52 cards INCLUDING deuces: the A2345 straight
/// needs a card in the 2 slot and it is a wild that fills it. A substituted
/// deuce is then read as an ordinary rank-2 card, which can never overstate the
/// hand. Duplicates are allowed — a wild may become a card already held, which
/// is the only way five of a kind exists at all.
#[allow(dead_code)] // used by generator/src tests as the differential reference evaluator
pub fn reference_category(cards: &[Card; 5]) -> Category {
    let wild_at: Vec<usize> = (0..5).filter(|&i| cards[i].rank() == TWO).collect();
    if wild_at.is_empty() { return natural_category(cards); }
    if wild_at.len() == 4 { return Category::FourDeuces; }

    let mut work = *cards;
    let mut best = Category::Nothing;
    fill(&mut work, &wild_at, 0, &mut best);

    // Any royal reached with a wild in hand is a WILD royal.
    if best == Category::NaturalRoyal { Category::WildRoyal } else { best }
}

/// Better means pays more, or pays the same and ranks higher.
///
/// Four of a kind and a full house both pay 4, so payout alone leaves their
/// order to the accident of substitution-iteration order. `Category` is
/// declared best-first, so its discriminant breaks the tie — and breaks it the
/// same way the fast evaluator does, by standard poker ranking.
///
/// This does not weaken the differential check. A hand that is only a full
/// house can never produce a quad under any substitution, so the fast
/// evaluator claiming quads there still mismatches. All this removes is a
/// disagreement about naming a hand that both sides agree is worth 4.
#[allow(dead_code)] // used by generator/src tests as the differential reference evaluator
fn better(a: Category, b: Category) -> bool {
    use std::cmp::Reverse;
    (a.payout(), Reverse(a as usize)) > (b.payout(), Reverse(b as usize))
}

#[allow(dead_code)] // used by generator/src tests as the differential reference evaluator
fn fill(work: &mut [Card; 5], wild_at: &[usize], k: usize, best: &mut Category) {
    if k == wild_at.len() {
        let c = natural_category(work);
        if better(c, *best) { *best = c; }
        return;
    }
    for candidate in Card::ALL {
        work[wild_at[k]] = candidate;
        fill(work, wild_at, k + 1, best);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::eval::deuces;

    fn h(spec: [(Rank, Suit); 5]) -> [Card; 5] {
        let mut out = [Card(0); 5];
        for (i, (r, s)) in spec.into_iter().enumerate() { out[i] = Card::new(r, s); }
        out
    }

    #[test]
    fn agrees_on_the_hands_that_are_easy_to_get_wrong() {
        for spec in [
            [(12,0),(1,1),(2,2),(3,3),(0,0)],   // ace-low straight via the wild
            [(8,0),(9,0),(10,0),(11,0),(0,2)],  // wild royal over a straight flush
            [(0,1),(1,1),(2,1),(3,1),(4,1)],    // 2 3 4 5 6 suited
            [(12,0),(12,1),(12,2),(12,3),(0,0)],// five aces
            [(5,0),(5,1),(9,2),(9,3),(0,0)],    // two pair plus a wild
        ] {
            let hand = h(spec);
            assert_eq!(reference_category(&hand), deuces::category(&hand), "{:?}", spec);
        }
    }

    /// The real check. Ignored by default because it evaluates roughly a
    /// billion substitutions; run it deliberately with
    /// `cargo test --release --  --ignored agrees_on_every_hand`.
    #[test]
    #[ignore = "exhaustive; run deliberately"]
    fn agrees_on_every_hand() {
        use rayon::prelude::*;
        let all = Card::ALL;
        let mismatches: Vec<String> = (0..52usize).into_par_iter().flat_map(|a| {
            let mut out = Vec::new();
            for b in a+1..52 { for c in b+1..52 { for d in c+1..52 { for e in d+1..52 {
                let hand = [all[a], all[b], all[c], all[d], all[e]];
                let fast = deuces::category(&hand);
                let slow = reference_category(&hand);
                if fast != slow {
                    out.push(format!("{:?}: fast={:?} slow={:?}", hand, fast, slow));
                }
            }}}}
            out
        }).collect();
        assert!(mismatches.is_empty(), "first 5 of {}: {:?}",
                mismatches.len(), &mismatches[..mismatches.len().min(5)]);
    }

    #[test]
    fn the_two_exactly_derivable_counts_are_right() {
        // Natural royals: one per suit, no deuce. Four deuces: all four twos
        // plus any of the remaining 48 cards. Both derivable without recall.
        let all = Card::ALL;
        let (mut royals, mut quads) = (0u32, 0u32);
        for a in 0..52 { for b in a+1..52 { for c in b+1..52 {
            for d in c+1..52 { for e in d+1..52 {
                match deuces::category(&[all[a], all[b], all[c], all[d], all[e]]) {
                    deuces::Category::NaturalRoyal => royals += 1,
                    deuces::Category::FourDeuces => quads += 1,
                    _ => {}
                }
            }}}}}
        assert_eq!(royals, 4);
        assert_eq!(quads, 48);
    }

    /// Prints the category census. Recorded in the README as measured, not
    /// asserted: unlike the Jacks-or-Better family, Deuces Wild category
    /// counts cannot be derived from standard combinatorics, so asserting
    /// them would only be asserting a number we made up.
    #[test]
    #[ignore = "reporting only; run deliberately"]
    fn print_category_census() {
        use std::collections::BTreeMap;
        let all = Card::ALL;
        let mut counts: BTreeMap<String, u64> = BTreeMap::new();
        for a in 0..52 { for b in a+1..52 { for c in b+1..52 {
            for d in c+1..52 { for e in d+1..52 {
                let cat = deuces::category(&[all[a], all[b], all[c], all[d], all[e]]);
                *counts.entry(format!("{:?}", cat)).or_insert(0) += 1;
            }}}}}
        let total: u64 = counts.values().sum();
        for (cat, n) in &counts {
            println!("{:<16} {:>9}  ({:6.3}%)", cat, n, 100.0 * *n as f64 / total as f64);
        }
        assert_eq!(total, 2_598_960);
    }
}
