use crate::card::*;
use crate::solve::{Best, Payout};

/// Every k-subset of `items`, materialised. Slow and plainly correct.
fn combinations(items: &[Card], k: usize) -> Vec<Vec<Card>> {
    if k == 0 { return vec![Vec::new()]; }
    if items.len() < k { return Vec::new(); }
    let mut out = Vec::new();
    for i in 0..=items.len() - k {
        for mut rest in combinations(&items[i + 1..], k - 1) {
            let mut one = vec![items[i]];
            one.append(&mut rest);
            out.push(one);
        }
    }
    out
}

pub fn reference_solve(hand: &[Card; 5], payout: Payout) -> Best {
    let deck: Vec<Card> = Card::ALL.iter().copied().filter(|c| !hand.contains(c)).collect();
    let mut best = Best { mask: 0, ev: -1.0 };
    for mask in 0u8..32 {
        let held: Vec<Card> = (0..5).filter(|i| mask & (1 << i) != 0)
            .map(|i| hand[i]).collect();
        let draws = combinations(&deck, 5 - held.len());
        let mut total = 0u64;
        for draw in &draws {
            let mut full = held.clone();
            full.extend_from_slice(draw);
            let arr: [Card; 5] = [full[0], full[1], full[2], full[3], full[4]];
            total += payout(&arr) as u64;
        }
        let ev = total as f64 / draws.len() as f64;
        if ev > best.ev { best = Best { mask, ev }; }
    }
    best
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::card::Card;
    use crate::eval::ddb::payout;
    use crate::solve::solve;
    use rand::prelude::*;

    #[test]
    fn fast_and_reference_solvers_agree_exactly() {
        let mut rng = StdRng::seed_from_u64(0xDDB);
        for trial in 0..50 {
            let mut deck: Vec<Card> = Card::ALL.to_vec();
            deck.shuffle(&mut rng);
            let hand: [Card; 5] = core::array::from_fn(|i| deck[i]);
            let fast = solve(&hand, payout);
            let slow = reference_solve(&hand, payout);
            assert_eq!(fast.mask, slow.mask, "trial {} hand {:?}", trial, hand);
            assert!((fast.ev - slow.ev).abs() < 1e-9,
                "trial {} EV {} vs {}", trial, fast.ev, slow.ev);
        }
    }
}
