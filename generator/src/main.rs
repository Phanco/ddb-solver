mod card; mod eval; mod canon; mod solve;
#[allow(dead_code)] mod reference;   // exercised only by tests

use canon::*;
use rayon::prelude::*;
use std::collections::BTreeMap;
use std::fs;
use std::io::Write;

/// EV is stored in 1/64ths of a coin. The ceiling must clear 800, the value of
/// a pat royal held; hundredths of a coin would cap at 655.35 and overflow.
const EV_SCALE: f64 = 64.0;

fn main() {
    let start = std::time::Instant::now();
    let hands = canonical_hands();
    assert_eq!(hands.len(), 134_459);
    eprintln!("enumerated {} canonical hands", hands.len());

    let solved: Vec<(usize, u8, f64, u32)> = hands
        .par_iter()
        .map(|(hand, idx)| {
            let best = solve::solve(hand, eval::ddb::payout);
            (*idx, best.mask, best.ev, orbit_size(hand))
        })
        .collect();
    eprintln!("solved in {:?}", start.elapsed());

    fs::create_dir_all("out").unwrap();

    // --- table -----------------------------------------------------------
    let mut table = vec![0u8; TOTAL_SLOTS * 3];
    for &(idx, mask, ev, _) in &solved {
        let scaled = (ev * EV_SCALE).round() as u32;
        assert!(scaled <= u16::MAX as u32, "EV {} overflows the slot", ev);
        let o = idx * 3;
        table[o] = mask | 0x80;                 // bit 7 marks the slot occupied
        table[o + 1..o + 3].copy_from_slice(&(scaled as u16).to_le_bytes());
    }
    fs::write("out/ddb96.bin", &table).unwrap();

    // --- cross-language fixture -----------------------------------------
    let mut fixture = Vec::with_capacity(hands.len() * 9);
    for (hand, idx) in &hands {
        for c in hand { fixture.push(c.0); }
        fixture.write_all(&(*idx as u32).to_le_bytes()).unwrap();
    }
    fs::write("out/canonical-hands.bin", &fixture).unwrap();

    // --- overall return --------------------------------------------------
    // Each canonical hand stands for `orbit` concrete deals, so the return is
    // orbit-weighted. An unweighted mean would be wrong and plausible-looking.
    let weighted: f64 = solved.iter().map(|&(_, _, ev, orbit)| ev * orbit as f64).sum();
    let deals: u64 = solved.iter().map(|&(_, _, _, orbit)| orbit as u64).sum();
    assert_eq!(deals, 2_598_960, "orbit sizes must cover every deal");
    println!("optimal return: {:.4}%", 100.0 * weighted / deals as f64);
    println!("  (published 9/6 DDB figure is ~98.98%. If the self-proving checks");
    println!("   all pass and this disagrees, investigate the published figure.)");

    // --- branch-count histogram -----------------------------------------
    let by_slot: BTreeMap<usize, u8> =
        solved.iter().map(|&(idx, mask, _, _)| (idx, mask)).collect();
    let orbit_by_slot: BTreeMap<usize, u32> =
        solved.iter().map(|&(idx, _, _, orbit)| (idx, orbit)).collect();

    let mut hist: BTreeMap<usize, u64> = BTreeMap::new();
    for rmi in 0..RANK_MULTISET_COUNT {
        let mut masks = std::collections::HashSet::new();
        let mut weight = 0u64;
        for spi in 0..SUIT_PATTERN_COUNT {
            let idx = slot_index(rmi, spi);
            if let Some(&m) = by_slot.get(&idx) {
                masks.insert(m);
                weight += orbit_by_slot[&idx] as u64;
            }
        }
        if !masks.is_empty() { *hist.entry(masks.len()).or_insert(0) += weight; }
    }
    println!("\nbranch-count histogram (deals weighted):");
    let total: u64 = hist.values().sum();
    for (branches, weight) in &hist {
        println!("  {:2} distinct hold(s): {:>9} deals  ({:5.2}%)",
            branches, weight, 100.0 * *weight as f64 / total as f64);
    }
}
