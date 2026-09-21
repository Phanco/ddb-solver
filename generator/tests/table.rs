// Integration test over the emitted table. Run only after `cargo run --release`.
use std::fs;

#[test]
#[ignore = "requires out/ddb96.bin from a full sweep"]
fn table_has_the_right_shape_and_occupancy() {
    let bytes = fs::read("out/ddb96.bin").expect("run `cargo run --release` first");
    assert_eq!(bytes.len(), 315_588 * 3);

    let valid = bytes.chunks_exact(3).filter(|s| s[0] & 0x80 != 0).count();
    assert_eq!(valid, 134_459, "occupied slots");

    for slot in bytes.chunks_exact(3) {
        if slot[0] & 0x80 == 0 {
            assert_eq!(slot, [0, 0, 0], "dead slots must be zeroed");
        } else {
            assert_eq!(slot[0] & 0b0110_0000, 0, "bits 5-6 are reserved");
            let ev = u16::from_le_bytes([slot[1], slot[2]]) as f64 / 64.0;
            assert!(ev > 0.0 && ev <= 800.0, "EV out of range: {}", ev);
        }
    }
}
