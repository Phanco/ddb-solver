use crate::card::*;

/// Deuces are wild. A deuce is NEVER a natural 2, so natural ranks never
/// include this rank and five of a kind can never be deuces.
const WILD: Rank = TWO;

/// The ten straight windows as 13-bit rank masks, A2345 through TJQKA.
///
/// A lookup rather than arithmetic on purpose: the ace is rank 12 while the
/// A2345 window also spans ranks 0-3, so a `max - min <= 4` test classifies the
/// ace-low straight wrong. The wilds fill whatever the naturals do not cover,
/// and since there are exactly `w` wilds and `5 - w` naturals the count always
/// works out.
pub const STRAIGHT_WINDOWS: [u16; 10] = [
    (1 << 12) | 0b1111,   // A 2 3 4 5 — the ace plays low
    0b11111,              // 2 3 4 5 6
    0b11111 << 1,
    0b11111 << 2,
    0b11111 << 3,
    0b11111 << 4,
    0b11111 << 5,
    0b11111 << 6,
    0b11111 << 7,
    0b11111 << 8,         // T J Q K A
];

/// T J Q K A.
pub const ROYAL_WINDOW: u16 = 0b11111 << 8;

#[derive(Clone, Copy, PartialEq, Eq, Debug, Hash)]
pub enum Category {
    NaturalRoyal, FourDeuces, WildRoyal, FiveOfAKind, StraightFlush,
    FourOfAKind, FullHouse, Flush, Straight, ThreeOfAKind, Nothing,
}

impl Category {
    #[allow(dead_code)] // used by generator/src tests to iterate every payout row
    pub const ALL: [Category; 11] = [
        Category::NaturalRoyal, Category::FourDeuces, Category::WildRoyal,
        Category::FiveOfAKind, Category::StraightFlush, Category::FourOfAKind,
        Category::FullHouse, Category::Flush, Category::Straight,
        Category::ThreeOfAKind, Category::Nothing,
    ];

    /// Illinois Deuces Wild, coins per coin bet.
    pub const fn payout(self) -> u32 {
        match self {
            Category::NaturalRoyal  => 800,
            Category::FourDeuces    => 200,
            Category::WildRoyal     => 25,
            Category::FiveOfAKind   => 15,
            Category::StraightFlush => 9,
            Category::FourOfAKind   => 4,
            Category::FullHouse     => 4,
            Category::Flush         => 3,
            Category::Straight      => 2,
            Category::ThreeOfAKind  => 1,
            Category::Nothing       => 0,
        }
    }
}

pub fn category(cards: &[Card; 5]) -> Category {
    let mut wilds = 0u32;
    let mut counts = [0u8; 13];
    let mut suits = 0u8;
    let mut present = 0u16;
    for c in cards {
        if c.rank() == WILD { wilds += 1; continue; }
        counts[c.rank() as usize] += 1;
        suits |= 1 << c.suit();
        present |= 1 << c.rank();
    }
    let naturals = 5 - wilds;

    // With no naturals at all there is nothing to disagree about; `count_ones`
    // is then 0, which is why this is `<= 1` and not `== 1`.
    let same_suit = suits.count_ones() <= 1;
    let distinct = present.count_ones() == naturals;
    let straight = distinct && STRAIGHT_WINDOWS.iter().any(|m| (present & !m) == 0);
    let royal_ranks = distinct && (present & !ROYAL_WINDOW) == 0;

    if wilds == 0 && same_suit && royal_ranks { return Category::NaturalRoyal; }
    if wilds == 4 { return Category::FourDeuces; }
    if wilds >= 1 && same_suit && royal_ranks { return Category::WildRoyal; }

    let mut sorted = counts;
    sorted.sort_unstable_by(|a, b| b.cmp(a));
    let (c1, c2) = (sorted[0] as u32, sorted[1] as u32);

    if c1 + wilds >= 5 { return Category::FiveOfAKind; }
    if same_suit && straight { return Category::StraightFlush; }
    // Quads before a full house. They pay the same, so this cannot change any
    // expected value, but the census needs the buckets distinct.
    if c1 + wilds >= 4 { return Category::FourOfAKind; }
    if 3u32.saturating_sub(c1) + 2u32.saturating_sub(c2) <= wilds { return Category::FullHouse; }
    if same_suit { return Category::Flush; }
    if straight { return Category::Straight; }
    if c1 + wilds >= 3 { return Category::ThreeOfAKind; }
    Category::Nothing
}

pub fn payout(cards: &[Card; 5]) -> u32 { category(cards).payout() }

#[cfg(test)]
mod tests {
    use super::*;

    fn h(spec: [(Rank, Suit); 5]) -> [Card; 5] {
        let mut out = [Card(0); 5];
        for (i, (r, s)) in spec.into_iter().enumerate() { out[i] = Card::new(r, s); }
        out
    }

    #[test]
    fn every_paytable_row_pays_its_stated_value() {
        // natural royal: T J Q K A of one suit, no deuce
        assert_eq!(payout(&h([(8,0),(9,0),(10,0),(11,0),(12,0)])), 800);
        // four deuces plus anything
        assert_eq!(payout(&h([(0,0),(0,1),(0,2),(0,3),(6,0)])), 200);
        // wild royal: T J Q K of one suit plus a deuce standing in for the ace
        assert_eq!(payout(&h([(8,0),(9,0),(10,0),(11,0),(0,1)])), 25);
        // five of a kind: four aces plus a deuce
        assert_eq!(payout(&h([(12,0),(12,1),(12,2),(12,3),(0,0)])), 15);
        // straight flush: 5 6 7 8 of one suit plus a deuce
        assert_eq!(payout(&h([(3,2),(4,2),(5,2),(6,2),(0,0)])), 9);
        // four of a kind: three sevens plus a deuce plus junk
        assert_eq!(payout(&h([(5,0),(5,1),(5,2),(0,0),(11,3)])), 4);
        // full house: two pair plus a deuce
        assert_eq!(payout(&h([(5,0),(5,1),(9,2),(9,3),(0,0)])), 4);
        // flush: five of one suit, no straight, no deuce
        assert_eq!(payout(&h([(1,3),(4,3),(6,3),(8,3),(11,3)])), 3);
        // straight: 6 7 8 9 T mixed suits
        assert_eq!(payout(&h([(4,0),(5,1),(6,2),(7,3),(8,0)])), 2);
        // three of a kind: one pair plus a deuce
        assert_eq!(payout(&h([(7,0),(7,1),(0,0),(3,2),(11,3)])), 1);
    }

    #[test]
    fn a_pair_and_two_pair_pay_nothing() {
        // Deuces Wild has no row below three of a kind.
        assert_eq!(payout(&h([(12,0),(12,1),(5,2),(7,3),(9,0)])), 0);  // pair of aces
        assert_eq!(payout(&h([(12,0),(12,1),(9,2),(9,3),(5,0)])), 0);  // two pair
    }

    #[test]
    fn the_deuce_fills_the_two_slot_in_an_ace_low_straight() {
        // A 3 4 5 + deuce is a straight. This is the case a `max - min <= 4`
        // test gets wrong: the ace is rank 12 and the window also spans 0..3.
        assert_eq!(payout(&h([(12,0),(1,1),(2,2),(3,3),(0,0)])), 2);
        // and suited, it is a straight flush rather than a wild royal
        assert_eq!(payout(&h([(12,0),(1,0),(2,0),(3,0),(0,1)])), 9);
    }

    #[test]
    fn a_natural_two_never_exists() {
        // 2 3 4 5 6 all one suit. The deuce is wild, so this is a straight
        // flush either way, but it must never be classified by treating the
        // deuce as a natural 2.
        assert_eq!(payout(&h([(0,1),(1,1),(2,1),(3,1),(4,1)])), 9);
    }

    #[test]
    fn a_wild_royal_outranks_the_straight_flush_it_also_satisfies() {
        // T J Q K + deuce is both a wild royal (25) and a 9-T-J-Q-K straight
        // flush (9). It must take the royal.
        assert_eq!(category(&h([(8,0),(9,0),(10,0),(11,0),(0,2)])), Category::WildRoyal);
    }

    #[test]
    fn four_deuces_beats_everything_it_could_also_be() {
        // Four deuces plus an ace could be read as five aces (15) or a wild
        // royal (25). Four deuces pays 200 and wins.
        assert_eq!(category(&h([(0,0),(0,1),(0,2),(0,3),(12,0)])), Category::FourDeuces);
    }

    #[test]
    fn categories_and_payouts_agree() {
        for c in Category::ALL { assert!(c.payout() <= 800); }
        assert_eq!(Category::NaturalRoyal.payout(), 800);
        assert_eq!(Category::FourOfAKind.payout(), Category::FullHouse.payout());
    }
}
