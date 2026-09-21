import { rank, type Rank } from './types';

export const RANK_LABELS = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'] as const;

/** Keypad layout: aces lead, then ascending, matching how a hand is read out. */
const LAYOUT: number[][] = [
  [12, 0, 1, 2, 3],
  [4, 5, 6, 7, 8],
  [9, 10, 11],
];

export function renderRanks(root: HTMLElement, onComplete: (ranks: Rank[]) => void): void {
  const chosen: number[] = [];

  function draw() {
    root.replaceChildren();

    const pad = document.createElement('div');
    pad.className = 'pad';
    for (const row of LAYOUT) {
      const r = document.createElement('div');
      r.className = 'pad-row';
      for (const rk of row) {
        const b = document.createElement('button');
        b.dataset.role = 'rank';
        b.textContent = RANK_LABELS[rk];
        b.disabled = chosen.filter(c => c === rk).length >= 4 || chosen.length >= 5;
        b.addEventListener('click', () => {
          chosen.push(rk);
          if (chosen.length === 5) { onComplete(chosen.map(rank) as Rank[]); return; }
          draw();
        });
        r.appendChild(b);
      }
      pad.appendChild(r);
    }
    root.appendChild(pad);

    const slots = document.createElement('div');
    slots.className = 'slots';
    for (let i = 0; i < 5; i++) {
      const s = document.createElement('button');
      s.dataset.role = 'slot';
      s.className = chosen[i] === undefined ? 'slot empty' : 'slot';
      s.textContent = chosen[i] === undefined ? '' : RANK_LABELS[chosen[i]];
      s.addEventListener('click', () => {
        if (chosen[i] === undefined) return;
        chosen.splice(i, 1);
        draw();
      });
      slots.appendChild(s);
    }
    root.appendChild(slots);
  }

  draw();
}
