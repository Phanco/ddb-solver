import { analyze, type Analysis } from './solver';
import type { Table } from './table';
import { RANK_LABELS } from './ui-ranks';
import type { Rank, Suit } from './types';

export const SUIT_LABELS = ['♥', '♦', '♣', '♠'] as const;

type Resolved = Extract<Analysis, { kind: 'resolved' }>;

export function renderSuits(
  root: HTMLElement,
  table: Table,
  ranks: readonly Rank[],
  onResolved: (a: Resolved, suits: (Suit | null)[]) => void,
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
      head.textContent = RANK_LABELS[ranks[pos]];
      col.appendChild(head);

      for (let s = 0; s < 4; s++) {
        const b = document.createElement('button');
        b.dataset.role = 'suit';
        b.dataset.pos = String(pos);
        b.dataset.suit = String(s);
        b.textContent = SUIT_LABELS[s];
        if (known[pos] === s) b.classList.add('chosen');
        b.addEventListener('click', () => { known[pos] = s as Suit; draw(); });
        col.appendChild(b);
      }
      cols.appendChild(col);
    }
    root.appendChild(cols);
  }

  draw();
}
