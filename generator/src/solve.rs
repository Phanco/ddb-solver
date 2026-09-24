use crate::card::*;

/// A game's paytable, as the only thing `solve` needs to know about it.
pub type Payout = fn(&[Card; 5]) -> u32;

pub struct Best { pub mask: u8, pub ev: f64 }

/// The 47 cards not in the hand.
fn remaining(hand: &[Card; 5]) -> Vec<Card> {
    Card::ALL.iter().copied().filter(|c| !hand.contains(c)).collect()
}

/// Sum payouts over every way to fill the open slots from `deck[start..]`.
fn walk(slots: &mut [Card; 5], filled: usize, deck: &[Card], start: usize,
        need: usize, total: &mut u64, count: &mut u64, payout: Payout) {
    if need == 0 {
        *total += payout(slots) as u64;
        *count += 1;
        return;
    }
    // Stop early when too few cards remain to fill the rest.
    for i in start..=deck.len() - need {
        slots[filled] = deck[i];
        walk(slots, filled + 1, deck, i + 1, need - 1, total, count, payout);
    }
}

#[allow(dead_code)] // used by generator/src tests to check EV of a specific hold
pub fn hold_ev(hand: &[Card; 5], mask: u8, payout: Payout) -> f64 {
    let deck = remaining(hand);
    let mut slots = [Card(0); 5];
    let mut filled = 0;
    for i in 0..5 {
        if mask & (1 << i) != 0 { slots[filled] = hand[i]; filled += 1; }
    }
    let need = 5 - filled;
    let (mut total, mut count) = (0u64, 0u64);
    walk(&mut slots, filled, &deck, 0, need, &mut total, &mut count, payout);
    total as f64 / count as f64
}

pub fn solve(hand: &[Card; 5], payout: Payout) -> Best {
    let deck = remaining(hand);
    let mut best = Best { mask: 0, ev: -1.0 };
    for mask in 0u8..32 {
        let mut slots = [Card(0); 5];
        let mut filled = 0;
        for i in 0..5 {
            if mask & (1 << i) != 0 { slots[filled] = hand[i]; filled += 1; }
        }
        let (mut total, mut count) = (0u64, 0u64);
        walk(&mut slots, filled, &deck, 0, 5 - filled, &mut total, &mut count, payout);
        let ev = total as f64 / count as f64;
        // Strict comparison, so the lowest mask wins ties and runs reproduce.
        if ev > best.ev { best = Best { mask, ev }; }
    }
    best
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::eval::ddb::payout;

    fn h(spec: [(Rank, Suit); 5]) -> [Card; 5] {
        let mut out = [Card(0); 5];
        for (i, (r, s)) in spec.into_iter().enumerate() { out[i] = Card::new(r, s); }
        out
    }

    /// Exact invariants, zero tolerance. A made hand held pat pays its row
    /// value with certainty — no averaging, no rounding.
    #[test]
    fn pat_hands_have_exact_expected_values() {
        let royal = h([(TEN,0),(JACK,0),(10,0),(11,0),(ACE,0)]);
        assert_eq!(hold_ev(&royal, 0b11111, payout), 800.0);
        let best = solve(&royal, payout);
        assert_eq!(best.mask, 0b11111);
        assert_eq!(best.ev, 800.0);

        let sf = h([(4,1),(5,1),(6,1),(7,1),(8,1)]);
        assert_eq!(hold_ev(&sf, 0b11111, payout), 50.0);

        let quad = h([(ACE,0),(ACE,1),(ACE,2),(ACE,3),(2,0)]);
        assert_eq!(hold_ev(&quad, 0b11111, payout), 400.0);
        assert_eq!(solve(&quad, payout).mask, 0b11111);
    }

    #[test]
    fn holding_nothing_still_has_positive_value() {
        let junk = h([(0,0),(2,1),(4,2),(6,3),(8,0)]);
        let ev = hold_ev(&junk, 0, payout);
        assert!(ev > 0.0 && ev < 1.0, "draw-five EV was {}", ev);
    }

    /// With three aces, DDB says DROP the kicker and draw two, despite the
    /// 400-per-coin low-kicker quad row. Drawing two nearly doubles the chance
    /// of catching the fourth ace, which outweighs the kicker bonus.
    ///
    /// Both values are exact rationals, so they are asserted exactly:
    ///   hold AAA+4, draw 1 of 47: 400 (4th ace) + 3*9 (full house) + 43*3
    ///     (trips) = 556  ->  556/47
    ///   hold AAA, draw 2 of 47 (C(47,2)=1081): 11*400 + 35*160 + 66*9 + 969*3
    ///     = 13501  ->  13501/1081
    /// The 11 low kickers are four 2s, four 3s and three 4s — the fourth 4 was
    /// dealt and discarded, so it cannot be drawn.
    #[test]
    fn three_aces_alone_beats_keeping_a_low_kicker() {
        let hand = h([(ACE,0),(ACE,1),(ACE,2),(2,3),(9,0)]);   // A A A 4 J
        let with_kicker = hold_ev(&hand, 0b01111, payout);   // three aces + the four
        let without     = hold_ev(&hand, 0b00111, payout);   // three aces alone
        assert_eq!(with_kicker, 556.0 / 47.0);
        assert_eq!(without, 13501.0 / 1081.0);
        assert!(without > with_kicker,
            "drawing two ({}) should beat keeping the kicker ({})",
            without, with_kicker);
        assert_eq!(solve(&hand, payout).mask, 0b00111);
    }
}
