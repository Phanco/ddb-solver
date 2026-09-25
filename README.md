# DDB Video Poker Solver

An installable, offline-first strategy trainer for video poker, max coin.
It solves two games — 9/6 Double Double Bonus and Illinois Deuces Wild —
and lets you switch between them. Enter the five ranks you were dealt; if
the ranks alone determine the optimal hold, you get the answer
immediately. If suits matter, you're asked for just the suits that
actually change the decision, then shown the hold and its expected value.

The entire app is a static bundle plus two 946,764-byte lookup tables
(`app/public/ddb96.bin`, `app/public/illinois-deuces.bin`), each covering
all 134,459 canonical hands for its game. There is no server and no
network dependency once installed — a service worker precaches the app
shell and both tables for offline use.

## Games

### 9/6 Double Double Bonus

Standard 9/6 DDB paytable, max coin.

### Illinois Deuces Wild

Per-coin paytable:

| Hand | Pays |
|---|---:|
| Natural royal flush | 800 |
| Four deuces | 200 |
| Wild royal flush | 25 |
| Five of a kind | 15 |
| Straight flush | 9 |
| Four of a kind | 4 |
| Full house | 4 |
| Flush | 3 |
| Straight | 2 |
| Three of a kind | 1 |

### Measured returns

- **9/6 Double Double Bonus: 98.9808%** (published figure 98.98%)
- **Illinois Deuces Wild: 98.9131%** (published figure 98.91%)

### Deuces category census (measured, not derived)

Unlike the Jacks-or-Better family, Deuces Wild category counts cannot be
derived from standard combinatorics, so these are measured by exhaustive
enumeration over all 2,598,960 five-card hands, not asserted:

| Category | Count | Share |
|---|---:|---:|
| NaturalRoyal | 4 | 0.000% |
| FourDeuces | 48 | 0.002% |
| WildRoyal | 480 | 0.018% |
| FiveOfAKind | 624 | 0.024% |
| StraightFlush | 2,068 | 0.080% |
| FullHouse | 12,672 | 0.488% |
| Flush | 14,472 | 0.557% |
| FourOfAKind | 31,552 | 1.214% |
| Straight | 62,232 | 2.394% |
| ThreeOfAKind | 355,080 | 13.662% |
| Nothing | 2,119,728 | 81.561% |

These total 2,598,960.

### Branch-count histograms (deals-weighted)

For each hand, the number of distinct holds that are optimal depending on
which suit arrangement you actually hold — i.e. how many "branches" the
ranks alone leave open. Both are measured, not derived.

**9/6 Double Double Bonus:**

| Distinct holds | Share of deals |
|---:|---:|
| 1  | 19.35% |
| 2  | 29.31% |
| 3  | 0.89% |
| 4  | 0.04% |
| 5  | 0.47% |
| 6  | 3.25% |
| 7  | 4.81% |
| 8  | 13.51% |
| 9  | 13.40% |
| 10 | 7.45% |
| 11 | 3.94% |
| 12 | 2.40% |
| 13 | 1.10% |
| 14 | 0.08% |

**Illinois Deuces Wild:**

| Distinct holds | Share of deals |
|---:|---:|
| 1  | 16.40% |
| 2  | 30.64% |
| 3  | 7.17% |
| 4  | 6.15% |
| 5  | 5.98% |
| 6  | 2.29% |
| 7  | 4.20% |
| 8  | 7.05% |
| 9  | 9.14% |
| 10 | 6.82% |
| 11 | 2.68% |
| 12 | 0.75% |
| 13 | 0.55% |
| 14 | 0.16% |
| 15 | 0.04% |

A hand with exactly 1 distinct hold is one where ranks alone settle the
strategy — suits are irrelevant to the decision. For DDB that's **19.35%
of deals**; for Deuces it's only **16.40% of deals**. Suits matter *more*
often in Deuces than in Double Double Bonus — the opposite of what might
be expected before measuring it, since Deuces has fewer paying categories
overall. For the remaining deals in each game, at least one suit
relationship changes the optimal hold, and the app asks for suits
accordingly.

## Regenerating the tables

The tables are build artifacts of the Rust generator, not something
edited by hand. Regenerating them:

1. Run the sweep, which produces both tables:
   ```bash
   cd generator && cargo run --release
   ```
2. Copy both tables into the app:
   ```bash
   cp out/ddb96.bin ../app/public/ddb96.bin
   cp out/illinois-deuces.bin ../app/public/illinois-deuces.bin
   ```
3. Copy the matching fixture so the cross-language agreement test checks
   the new tables, not stale ones:
   ```bash
   cp out/canonical-hands.bin ../app/test-fixtures/canonical-hands.bin
   ```
4. Rebuild the app so `app/dist/*.bin` — the copies users actually run —
   pick up the new solve:
   ```bash
   cd ../app && npm run build
   ```

Both `app/public/*.bin` and `app/dist/` are committed (the tables appear
in the repo twice), so a fresh clone runs and tests correctly without a
Rust toolchain or a build step.

## Development

```bash
cd app
npm install
npm test          # vitest
npx tsc --noEmit   # type check
npm run build      # production build -> app/dist
npm run dev        # local dev server
```

The build is a PWA (`vite-plugin-pwa`, `generateSW` mode): the precache glob
includes the `bin` extension, so every table in `app/public/*.bin` — both
`ddb96.bin` and `illinois-deuces.bin` today, and any table added later —
is picked up automatically. Without that extension in the glob, the default
precache globs skip unknown file extensions and would otherwise ship a
service worker that installs cleanly and then can't answer anything
offline.
