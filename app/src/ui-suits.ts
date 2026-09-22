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
  // Frozen on the first draw. See the note on `.suit-col.narrow` in style.css:
  // recomputing widths as suits arrive moves targets under the thumb.
  let narrow: boolean[] | null = null;

  function draw() {
    const a = analyze(table, ranks, known);
    if (a.kind === 'resolved') { onResolved(a, known); return; }
    if (!narrow) narrow = a.relevant.map(r => !r);

    const { stage, dock } = shell(root);
    const left = a.relevant.filter((r, i) => r && known[i] === null).length;
    stage.appendChild(el(
      'p',
      'caption',
      left === 1 ? 'One more suit decides it.' : `${left} suits still matter.`,
    ));

    const cols = el('div', 'suits');
    for (let pos = 0; pos < 5; pos++) {
      // Width comes from `narrow`, frozen on the first draw; colour comes from
      // current relevance. Keeping those separate is what stops a column from
      // resizing under the thumb that just tapped it.
      const classes = ['suit-col'];
      if (narrow[pos]) classes.push('narrow');
      if (!a.relevant[pos]) classes.push('dim');
      const col = el('div', classes.join(' '));

      const head = el('div', 'suit-head', RANK_LABELS[ranks[pos]]);
      // "any" means "you need not answer this", so it is wrong once answered.
      if (!a.relevant[pos] && known[pos] === null) {
        // Stacked rather than inline: a narrow column is only ~2.25rem wide,
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
