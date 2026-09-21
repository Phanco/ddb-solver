pub type Rank = u8;
pub type Suit = u8;

pub const TWO: Rank = 0;
pub const FOUR: Rank = 2;
pub const TEN: Rank = 8;
pub const JACK: Rank = 9;
pub const ACE: Rank = 12;

/// A card packed as `rank * 4 + suit`, so sorting by the raw byte sorts by rank.
/// Which concrete suit a suit number denotes is irrelevant — no paytable row
/// distinguishes hearts from spades.
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Debug, Hash)]
pub struct Card(pub u8);

impl Card {
    pub const ALL: [Card; 52] = {
        let mut a = [Card(0); 52];
        let mut i = 0;
        while i < 52 { a[i] = Card(i as u8); i += 1; }
        a
    };
    pub const fn new(rank: Rank, suit: Suit) -> Card { Card(rank * 4 + suit) }
    pub const fn rank(self) -> Rank { self.0 / 4 }
    pub const fn suit(self) -> Suit { self.0 % 4 }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn card_roundtrips_rank_and_suit() {
        for rank in 0u8..13 {
            for suit in 0u8..4 {
                let c = Card::new(rank, suit);
                assert_eq!(c.rank(), rank);
                assert_eq!(c.suit(), suit);
            }
        }
    }

    #[test]
    fn all_contains_52_distinct_cards() {
        let mut seen = std::collections::HashSet::new();
        for c in Card::ALL { assert!(seen.insert(c.0)); }
        assert_eq!(seen.len(), 52);
    }
}
