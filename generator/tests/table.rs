// Integration test over the emitted tables. Runs automatically whenever a
// table is present (i.e. after `cargo run --release`); since generator/out/ is
// gitignored, it cannot be made mandatory, so it degrades to a no-op rather
// than failing a fresh checkout.
use std::fs;
use std::path::Path;

fn check(path: &str) {
    if !Path::new(path).exists() {
        eprintln!("skipping {}: not present — run `cargo run --release` first", path);
        return;
    }
    let bytes = fs::read(path).unwrap();
    assert_eq!(bytes.len(), 315_588 * 3, "{}", path);

    let valid = bytes.chunks_exact(3).filter(|s| s[0] & 0x80 != 0).count();
    assert_eq!(valid, 134_459, "{}: occupied slots", path);

    for slot in bytes.chunks_exact(3) {
        if slot[0] & 0x80 == 0 {
            assert_eq!(slot, [0, 0, 0], "{}: dead slots must be zeroed", path);
        } else {
            assert_eq!(slot[0] & 0b0110_0000, 0, "{}: bits 5-6 are reserved", path);
            let ev = u16::from_le_bytes([slot[1], slot[2]]) as f64 / 64.0;
            assert!(ev > 0.0 && ev <= 800.0, "{}: EV out of range: {}", path, ev);
        }
    }
}

#[test]
fn both_tables_have_the_right_shape_and_occupancy() {
    check("out/ddb96.bin");
    check("out/illinois-deuces.bin");
}
