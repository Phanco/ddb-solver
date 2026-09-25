import { RANK_LABELS } from './ui-ranks';
import { SUIT_LABELS } from './ui-suits';
import { button, el, shell } from './ui-shell';
import type { Game } from './games';
import type { EntryMask, Rank, Suit } from './types';

const RED_SUITS = new Set<number>([0, 1]);

export function renderAnswer(
  root: HTMLElement,
  game: Game,
  ranks: readonly Rank[],
  suits: readonly (Suit | null)[],
  mask: EntryMask,
  evLow: number,
  evHigh: number,
  onRestart: () => void,
): void {
  const { stage, dock } = shell(root);

  const tag = el('p', 'caption', `${game.short} · ${game.returnPct}`);
  tag.dataset.role = 'game-label';
  stage.appendChild(tag);

  const row = el('div', 'result');
  for (let i = 0; i < 5; i++) {
    const held = (mask & (1 << i)) !== 0;
    const suit = suits[i];
    const red = suit !== null && RED_SUITS.has(suit);
    const c = el('div', `card ${held ? 'hold' : 'discard'}${red ? ' red' : ''}`);
    c.style.animationDelay = held ? `${i * 26}ms` : '0ms';
    c.textContent = RANK_LABELS[ranks[i]] + (suit === null ? '' : SUIT_LABELS[suit]);
    row.appendChild(c);
  }
  stage.appendChild(row);

  // Positions, never ranks: two cards can share a rank, but not a slot.
  const held = [0, 1, 2, 3, 4].filter(i => mask & (1 << i)).map(i => i + 1);
  const instruction = el(
    'p',
    'verdict',
    held.length === 0 ? 'Hold nothing — draw five.' : `Hold ${held.join(', ')}`,
  );
  instruction.dataset.role = 'instruction';
  stage.appendChild(instruction);

  // A range, not a midpoint: if suits were never pinned down the EV genuinely
  // spans a window, and a single figure would invent precision.
  const ev = el(
    'p',
    'ev',
    Math.abs(evHigh - evLow) < 0.005
      ? `EV ${evLow.toFixed(2)} coins`
      : `EV ${evLow.toFixed(2)}–${evHigh.toFixed(2)} coins`,
  );
  ev.dataset.role = 'ev';
  stage.appendChild(ev);

  const again = button('primary', 'New hand', onRestart);
  again.dataset.role = 'restart';
  dock.appendChild(again);
}
