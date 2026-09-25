import { rank, type Rank } from './types';
import { otherGame, type Game, type GameId } from './games';
import { button, el, shell, handToggle } from './ui-shell';

export const RANK_LABELS = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'] as const;

/**
 * Ascending, wrapped 5 / 4 / 4 so that J Q K A land in the widest keys on the
 * row nearest the thumb. In Double Double Bonus the high ranks are the ones
 * that carry the paytable, so they get the shortest reach and the biggest
 * target; the order stays strictly ascending so the eye never has to search.
 */
const LAYOUT: number[][] = [
  [0, 1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12],
];

export function renderRanks(
  root: HTMLElement,
  game: Game,
  onComplete: (ranks: Rank[]) => void,
  onSwitch: (id: GameId) => void,
): void {
  const chosen: number[] = [];

  function draw() {
    const { stage, dock } = shell(root);

    stage.appendChild(el(
      'p',
      'caption',
      chosen.length === 0
        ? `${game.label} · type the five ranks you were dealt.`
        : `${5 - chosen.length} to go. Tap a card to clear it.`,
    ));

    const hand = el('div', 'hand');
    for (let i = 0; i < 5; i++) {
      const filled = chosen[i] !== undefined;
      const s = button(filled ? 'slot' : 'slot empty', filled ? RANK_LABELS[chosen[i]] : '·', () => {
        if (!filled) return;
        chosen.splice(i, 1);
        draw();
      });
      s.dataset.role = 'slot';
      if (!filled) s.disabled = true;
      s.setAttribute('aria-label', filled ? `Card ${i + 1}: ${RANK_LABELS[chosen[i]]}. Tap to clear` : `Card ${i + 1}: empty`);
      hand.appendChild(s);
    }
    dock.appendChild(hand);

    const pad = el('div', 'pad');
    pad.style.marginTop = '0.75rem';
    for (const row of LAYOUT) {
      const r = el('div', 'keyrow');
      r.style.gridTemplateColumns = `repeat(${row.length}, 1fr)`;
      for (const rk of row) {
        const b = button('key', RANK_LABELS[rk], () => {
          chosen.push(rk);
          if (chosen.length === 5) { onComplete(chosen.map(rank) as Rank[]); return; }
          draw();
        });
        b.dataset.role = 'rank';
        b.disabled = chosen.filter(c => c === rk).length >= 4;
        r.appendChild(b);
      }
      pad.appendChild(r);
    }
    dock.appendChild(pad);

    const toggle = handToggle(draw);
    if (toggle) dock.appendChild(toggle);

    const next = otherGame(game);
    const swap = button('hand-toggle', `Switch to ${next.label}`, () => onSwitch(next.id));
    swap.dataset.role = 'game';
    dock.appendChild(swap);
  }

  draw();
}
