import { analyze, type Analysis } from './solver';
import type { Table } from './table';
import { RANK_LABELS } from './ui-ranks';
import { button, el, shell } from './ui-shell';
import type { Rank, Suit } from './types';

export const SUIT_LABELS = ['♥', '♦', '♣', '♠'] as const;
const RED_SUITS = new Set<number>([0, 1]);

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

    const { stage, dock } = shell(root);
    const live = a.relevant.filter(Boolean).length;
    stage.appendChild(el(
      'p',
      'caption',
      live === 1
        ? 'One more suit decides it.'
        : `${live} suits decide this hand. The rest are marked any.`,
    ));

    const cols = el('div', 'suits');
    for (let pos = 0; pos < 5; pos++) {
      // Columns that cannot change the play shrink rather than only fading, so
      // the ones that still matter get the width — and width is thumb accuracy.
      const col = el('div', a.relevant[pos] ? 'suit-col' : 'suit-col dim');

      const head = el('div', 'suit-head', RANK_LABELS[ranks[pos]]);
      if (!a.relevant[pos]) {
        // Stacked rather than inline: a dimmed column is only ~2.25rem wide,
        // and "9 any" on one line clips to "9 a".
        head.appendChild(el('span', 'any', 'any'));
      }
      col.appendChild(head);

      for (let s = 0; s < 4; s++) {
        const cls = RED_SUITS.has(s) ? 'suit red' : 'suit';
        const b = button(known[pos] === s ? `${cls} chosen` : cls, SUIT_LABELS[s], () => {
          // Belt and braces: the duplicate button is already disabled, but
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
        b.dataset.role = 'suit';
        b.dataset.pos = String(pos);
        b.dataset.suit = String(s);
        b.setAttribute('aria-label', `Card ${pos + 1} ${RANK_LABELS[ranks[pos]]}, suit ${SUIT_LABELS[s]}`);
        // Two cards of the same rank in the same suit would be the same
        // physical card — disable so it can never be tapped.
        if (wouldDuplicateCard(ranks, known, pos, s as Suit)) b.disabled = true;
        col.appendChild(b);
      }
      cols.appendChild(col);
    }
    dock.appendChild(cols);

    const restart = button('ghost', 'New hand', onRestart);
    restart.dataset.role = 'restart';
    restart.style.width = '100%';
    restart.style.marginTop = '0.75rem';
    dock.appendChild(restart);
  }

  draw();
}
