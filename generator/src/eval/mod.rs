//! One evaluator per game. Every evaluator exposes the same `payout` signature
//! so `solve` can be handed whichever game is being swept.
pub mod ddb;
pub mod deuces;
#[cfg(test)]
pub mod wild_ref;
