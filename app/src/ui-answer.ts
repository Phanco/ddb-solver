import { RANK_LABELS } from './ui-ranks';
import { SUIT_LABELS } from './ui-suits';
import type { EntryMask, Rank, Suit } from './types';

export function renderAnswer(
  root: HTMLElement,
  ranks: readonly Rank[],
  suits: readonly (Suit | null)[],
  mask: EntryMask,
  evLow: number,
  evHigh: number,
  onRestart: () => void,
): void {
  root.replaceChildren();

  const row = document.createElement('div');
  row.className = 'answer';
  for (let i = 0; i < 5; i++) {
    const held = (mask & (1 << i)) !== 0;
    const c = document.createElement('div');
    c.className = held ? 'card hold' : 'card discard';
    const suit = suits[i];
    c.textContent = RANK_LABELS[ranks[i]] + (suit === null ? '' : SUIT_LABELS[suit]);
    row.appendChild(c);
  }
  root.appendChild(row);

  // Positions, never ranks: two cards can share a rank, but not a slot.
  const held = [0, 1, 2, 3, 4].filter(i => mask & (1 << i)).map(i => i + 1);
  const instruction = document.createElement('p');
  instruction.dataset.role = 'instruction';
  instruction.textContent = held.length === 0
    ? 'Hold nothing — draw five.'
    : `Hold ${held.join(', ')}`;
  root.appendChild(instruction);

  const ev = document.createElement('p');
  ev.dataset.role = 'ev';
  // A range, not a midpoint: if suits were never pinned down the EV genuinely
  // spans a window, and a single figure would invent precision.
  ev.textContent = Math.abs(evHigh - evLow) < 0.005
    ? `EV ${evLow.toFixed(2)} coins`
    : `EV ${evLow.toFixed(2)}–${evHigh.toFixed(2)} coins`;
  root.appendChild(ev);

  const again = document.createElement('button');
  again.dataset.role = 'restart';
  again.textContent = 'New hand';
  again.addEventListener('click', onRestart);
  root.appendChild(again);
}
