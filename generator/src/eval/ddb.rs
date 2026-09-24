use crate::card::*;

#[derive(Clone, Copy, PartialEq, Eq, Debug, Hash)]
pub enum Category {
    RoyalFlush, StraightFlush,
    FourAcesLowKicker, FourLowLowKicker, FourAces, FourLow, FourHigh,
    FullHouse, Flush, Straight, Trips, TwoPair, JacksOrBetter, Nothing,
}

impl Category {
    #[allow(dead_code)] // used by generator/src tests to iterate every payout row
    pub const ALL: [Category; 14] = [
        Category::RoyalFlush, Category::StraightFlush,
        Category::FourAcesLowKicker, Category::FourLowLowKicker,
        Category::FourAces, Category::FourLow, Category::FourHigh,
        Category::FullHouse, Category::Flush, Category::Straight,
        Category::Trips, Category::TwoPair, Category::JacksOrBetter,
        Category::Nothing,
    ];

    /// Coins per coin bet, from the 9/6 DDB max-coin column divided by 5.
    pub const fn payout(self) -> u32 {
        match self {
            Category::RoyalFlush        => 800,
            Category::StraightFlush     => 50,
            Category::FourAcesLowKicker => 400,
            Category::FourLowLowKicker  => 160,
            Category::FourAces          => 160,
            Category::FourLow           => 80,
            Category::FourHigh          => 50,
            Category::FullHouse         => 9,
            Category::Flush             => 6,
            Category::Straight          => 4,
            Category::Trips             => 3,
            Category::TwoPair           => 1,
            Category::JacksOrBetter     => 1,
            Category::Nothing           => 0,
        }
    }
}

/// True for ranks 2, 3 and 4 — the DDB "low" ranks that appear both as quads
/// with their own payout rows and as premium kickers.
const fn is_low(r: Rank) -> bool { r <= FOUR }

pub fn category(cards: &[Card; 5]) -> Category {
    let mut counts = [0u8; 13];
    let mut suits = 0u8;
    let mut present = 0u16;
    for c in cards {
        counts[c.rank() as usize] += 1;
        suits |= 1 << c.suit();
        present |= 1 << c.rank();
    }
    let flush = suits.count_ones() == 1;

    // A straight needs five distinct ranks that are consecutive. The wheel
    // (A-2-3-4-5) is not consecutive in this encoding and is handled explicitly.
    const WHEEL: u16 = (1 << ACE) | 0b1111;      // A,2,3,4,5
    const ROYAL: u16 = 0b1_1111_0000_0000;        // T,J,Q,K,A
    let straight = present.count_ones() == 5
        && ((present >> present.trailing_zeros()) == 0b11111 || present == WHEEL);

    if flush && straight {
        return if present == ROYAL { Category::RoyalFlush } else { Category::StraightFlush };
    }

    if let Some(quad) = (0..13).find(|&r| counts[r] == 4) {
        let kicker = (0..13).find(|&r| counts[r] == 1).unwrap() as Rank;
        let quad = quad as Rank;
        return if quad == ACE {
            if is_low(kicker) { Category::FourAcesLowKicker } else { Category::FourAces }
        } else if is_low(quad) {
            if is_low(kicker) || kicker == ACE { Category::FourLowLowKicker } else { Category::FourLow }
        } else {
            Category::FourHigh
        };
    }

    let trips = counts.iter().any(|&c| c == 3);
    let pairs = counts.iter().filter(|&&c| c == 2).count();

    if trips && pairs == 1 { return Category::FullHouse; }
    if flush           { return Category::Flush; }
    if straight        { return Category::Straight; }
    if trips           { return Category::Trips; }
    if pairs == 2      { return Category::TwoPair; }
    if pairs == 1 {
        let pr = (0..13).find(|&r| counts[r] == 2).unwrap() as Rank;
        if pr >= JACK { return Category::JacksOrBetter; }
    }
    Category::Nothing
}

pub fn payout(cards: &[Card; 5]) -> u32 { category(cards).payout() }

#[cfg(test)]
mod tests {
    use super::*;

    fn hand(spec: &[(Rank, Suit)]) -> [Card; 5] {
        let mut h = [Card(0); 5];
        for (i, &(r, s)) in spec.iter().enumerate() { h[i] = Card::new(r, s); }
        h
    }

    #[test]
    fn royal_and_straight_flush() {
        assert_eq!(payout(&hand(&[(TEN,0),(JACK,0),(10,0),(11,0),(ACE,0)])), 800);
        assert_eq!(payout(&hand(&[(4,1),(5,1),(6,1),(7,1),(8,1)])), 50);
        // The wheel A-2-3-4-5 is a straight flush, not a royal.
        assert_eq!(payout(&hand(&[(ACE,2),(0,2),(1,2),(2,2),(3,2)])), 50);
    }

    #[test]
    fn quad_kicker_boundaries() {
        // Four Aces: a 2/3/4 kicker pays 400, anything else 160.
        assert_eq!(payout(&hand(&[(ACE,0),(ACE,1),(ACE,2),(ACE,3),(FOUR,0)])), 400);
        assert_eq!(payout(&hand(&[(ACE,0),(ACE,1),(ACE,2),(ACE,3),(3,0)])), 160);
        // Four 2s: an A/2/3/4 kicker pays 160, anything else 80.
        assert_eq!(payout(&hand(&[(TWO,0),(TWO,1),(TWO,2),(TWO,3),(1,0)])), 160);
        assert_eq!(payout(&hand(&[(TWO,0),(TWO,1),(TWO,2),(TWO,3),(ACE,0)])), 160);
        assert_eq!(payout(&hand(&[(TWO,0),(TWO,1),(TWO,2),(TWO,3),(3,0)])), 80);
        // Four 5s through Ks never care about the kicker.
        assert_eq!(payout(&hand(&[(3,0),(3,1),(3,2),(3,3),(ACE,0)])), 50);
    }

    #[test]
    fn remaining_rows() {
        assert_eq!(payout(&hand(&[(5,0),(5,1),(5,2),(7,0),(7,1)])), 9);   // full house
        assert_eq!(payout(&hand(&[(0,3),(4,3),(6,3),(8,3),(11,3)])), 6);  // flush
        assert_eq!(payout(&hand(&[(4,0),(5,1),(6,2),(7,3),(8,0)])), 4);   // straight
        assert_eq!(payout(&hand(&[(5,0),(5,1),(5,2),(7,0),(9,1)])), 3);   // trips
        assert_eq!(payout(&hand(&[(5,0),(5,1),(7,0),(7,1),(9,1)])), 1);   // two pair
        assert_eq!(payout(&hand(&[(JACK,0),(JACK,1),(2,0),(5,1),(7,2)])), 1);
        assert_eq!(payout(&hand(&[(8,0),(8,1),(2,0),(5,1),(7,2)])), 0);   // pair of tens
    }

    #[test]
    fn category_and_payout_agree() {
        let h = hand(&[(ACE,0),(ACE,1),(ACE,2),(ACE,3),(FOUR,0)]);
        assert_eq!(category(&h), Category::FourAcesLowKicker);
        assert_eq!(category(&h).payout(), payout(&h));
    }

    /// Every 5-card hand, bucketed by category, against counts derived
    /// independently from combinatorics. The quad split is the DDB-specific
    /// part: 4 aces * 12 low kickers = 12; 4 aces * 36 other = 36;
    /// 3 low quads * 12 low-or-ace kickers = 36; 3 low quads * 36 other = 108;
    /// 9 high quads * 48 kickers = 432. Total 624, the known quad count.
    #[test]
    fn census_matches_known_combinatorics() {
        use std::collections::HashMap;
        let mut counts: HashMap<Category, u64> = HashMap::new();
        let all = Card::ALL;
        for a in 0..52 { for b in a+1..52 { for c in b+1..52 {
            for d in c+1..52 { for e in d+1..52 {
                let h = [all[a], all[b], all[c], all[d], all[e]];
                *counts.entry(category(&h)).or_insert(0) += 1;
            }}}}}

        let expected = [
            (Category::RoyalFlush,               4u64),
            (Category::StraightFlush,           36),
            (Category::FourAcesLowKicker,       12),
            (Category::FourAces,                36),
            (Category::FourLowLowKicker,        36),
            (Category::FourLow,                108),
            (Category::FourHigh,               432),
            (Category::FullHouse,             3744),
            (Category::Flush,                 5108),
            (Category::Straight,             10200),
            (Category::Trips,                54912),
            (Category::TwoPair,             123552),
            (Category::JacksOrBetter,       337920),
            (Category::Nothing,            2062860),
        ];
        for (cat, want) in expected {
            assert_eq!(counts.get(&cat).copied().unwrap_or(0), want, "{:?}", cat);
        }
        assert_eq!(counts.values().sum::<u64>(), 2_598_960);
    }
}
