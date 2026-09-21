# DDB Video Poker Solver

An installable, offline-first strategy trainer for 9/6 Double Double Bonus
video poker, max coin. Enter the five ranks you were dealt; if the ranks
alone determine the optimal hold, you get the answer immediately. If suits
matter, you're asked for just the suits that actually change the decision,
then shown the hold and its expected value.

The entire app is a static bundle plus a 946,764-byte lookup table
(`app/public/ddb96.bin`) covering all 134,459 canonical hands. There is no
server and no network dependency once installed — a service worker
precaches the app shell and the table itself for offline use.

## Regenerating the table

The table is a build artifact of the Rust generator, not something edited
by hand.

```bash
cd generator && cargo run --release
cp out/ddb96.bin ../app/public/ddb96.bin
```

`app/public/ddb96.bin` is gitignored (regenerable, and large); `app/dist/`
— the built app, table included — is committed instead, so the app runs
straight from a clone without a Rust toolchain or a build step.

## Results

The generator exhaustively solved 9/6 Double Double Bonus, max coin, across
all 134,459 canonical hands.

- **Optimal return: 98.9808%**
- **Sweep time: 421 seconds across 14 cores** for all 134,459 canonical hands

### Branch-count histogram (deals-weighted)

For each hand, the number of distinct holds that are optimal depending on
which suit arrangement you actually hold — i.e. how many "branches" the
ranks alone leave open:

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

A hand with exactly 1 distinct hold is one where ranks alone settle the
strategy — suits are irrelevant to the decision. That's **19.35% of deals,
about one hand in five** — not most. For the remaining ~80.65%, at least
one suit relationship (usually "are these two the same suit") changes the
optimal hold, and the app asks for suits accordingly.

## Development

```bash
cd app
npm install
npm test          # vitest
npx tsc --noEmit   # type check
npm run build      # production build -> app/dist
npm run dev        # local dev server
```

The build is a PWA (`vite-plugin-pwa`, `generateSW` mode): it precaches
`ddb96.bin` explicitly, because the default precache globs skip unknown
file extensions and would otherwise ship a service worker that installs
cleanly and then can't answer anything offline.
