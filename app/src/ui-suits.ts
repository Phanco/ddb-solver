import { analyze, type Analysis } from './solver';
import type { Table } from './table';
import { RANK_LABELS } from './ui-ranks';
import type { Rank, Suit } from './types';

export const SUIT_LABELS = ['♥', '♦', '♣', '♠'] as const;

type Resolved = Extract<Analysis, { kind: 'resolved' }>;

/** True when placing suit `s` at `pos` would duplicate a card already fixed elsewhere. */
function wouldDuplicateCard(
  ranks: readonly Rank[],
  known: readonly (Suit | null)[],
  pos: number,
  s: Suit,
): boolean {
  for (let other = 0; other < 5; other++) {
    if (other === pos) continue;
    if (ranks[other] === ranks[pos] && known[other] === s) return true;
  }
  return false;
}

export function renderSuits(
  root: HTMLElement,
  table: Table,
  ranks: readonly Rank[],
  onResolved: (a: Resolved, suits: (Suit | null)[]) => void,
  onRestart: () => void,
): void {
  const known: (Suit | null)[] = [null, null, null, null, null];

  function draw() {
    const a = analyze(table, ranks, known);
    if (a.kind === 'resolved') { onResolved(a, known); return; }

    root.replaceChildren();
    const h = document.createElement('h2');
    h.textContent = 'Select suits';
    root.appendChild(h);

    const cols = document.createElement('div');
    cols.className = 'answer';
    for (let pos = 0; pos < 5; pos++) {
      const col = document.createElement('div');
      // A column nobody needs to answer is dimmed rather than removed, so the
      // five columns stay aligned with the five cards on the machine.
      col.className = a.relevant[pos] ? 'suit-col' : 'suit-col dim';

      const head = document.createElement('div');
      head.className = 'slot';
      head.textContent = a.relevant[pos] ? RANK_LABELS[ranks[pos]] : `${RANK_LABELS[ranks[pos]]} (any)`;
      col.appendChild(head);

      for (let s = 0; s < 4; s++) {
        const b = document.createElement('button');
        b.dataset.role = 'suit';
        b.dataset.pos = String(pos);
        b.dataset.suit = String(s);
        b.textContent = SUIT_LABELS[s];
        if (known[pos] === s) b.classList.add('chosen');
        // Two cards of the same rank in the same suit would be the same
        // physical card — disable the button so it can never be tapped.
        const duplicate = wouldDuplicateCard(ranks, known, pos, s as Suit);
        if (duplicate) b.disabled = true;
        b.addEventListener('click', () => {
          // Belt and braces: even though the duplicate button is disabled,
          // verify against a tentative copy before committing. A bad
          // assignment must never corrupt `known` or leave the screen unable
          // to redraw.
          const tentative = known.slice();
          tentative[pos] = s as Suit;
          try {
            analyze(table, ranks, tentative);
          } catch {
            return;
          }
          known[pos] = s as Suit;
          draw();
        });
        col.appendChild(b);
      }
      cols.appendChild(col);
    }
    root.appendChild(cols);

    const restart = document.createElement('button');
    restart.dataset.role = 'restart';
    restart.textContent = 'New hand';
    restart.addEventListener('click', () => onRestart());
    root.appendChild(restart);
  }

  draw();
}
