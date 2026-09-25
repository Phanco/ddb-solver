import type { Branches } from './branches';
import { RANK_LABELS } from './ui-ranks';
import { button, el, shell } from './ui-shell';
import type { Game } from './games';
import type { Rank } from './types';

/**
 * The zero-tap answer for hands whose play turns on one suit question.
 *
 * The condition names ranks, not slots, because it is existential: for
 * `A A K Q J` the rule is "K, Q, J and an ace", and which ace carries it
 * changes from deal to deal. So the held cards are described as "those four"
 * — the player can see which ace is the heart faster than we could name it.
 * The fallback branch names slots, where the cards are fixed.
 */
export function renderReadout(
  root: HTMLElement,
  game: Game,
  ranks: readonly Rank[],
  b: Branches,
  onPickSuits: () => void,
  onRestart: () => void,
): void {
  const { stage, dock } = shell(root);

  const tag = el('p', 'caption', `${game.short} · ${game.returnPct}`);
  tag.dataset.role = 'game-label';
  stage.appendChild(tag);

  const row = el('div', 'result');
  for (let i = 0; i < 5; i++) {
    const c = el('div', 'card', RANK_LABELS[ranks[i]]);
    row.appendChild(c);
  }
  stage.appendChild(row);

  const cond = b.conditionRanks.map(r => RANK_LABELS[r]).join(' ');

  const yes = el('div', 'branch branch-if');
  yes.dataset.role = 'branch-if';
  yes.appendChild(el('p', 'branch-cond', `If ${cond} share a suit`));
  yes.appendChild(el('p', 'branch-do', `Hold those ${b.conditionRanks.length}`));
  yes.appendChild(el('p', 'branch-ev', `EV ${b.evIfSuited.toFixed(2)} coins`));
  stage.appendChild(yes);

  const slots = [0, 1, 2, 3, 4].filter(i => b.holdOtherwise & (1 << i)).map(i => i + 1);
  const no = el('div', 'branch branch-else');
  no.dataset.role = 'branch-else';
  no.appendChild(el('p', 'branch-cond', 'Otherwise'));
  no.appendChild(el('p', 'branch-do', slots.length === 0 ? 'Hold nothing' : `Hold ${slots.join(', ')}`));
  no.appendChild(el('p', 'branch-ev', `EV ${b.evOtherwise.toFixed(2)} coins`));
  stage.appendChild(no);

  const actions = el('div', 'actions');
  const pick = button('ghost', 'Pick suits', onPickSuits);
  pick.dataset.role = 'pick-suits';
  const again = button('ghost', 'New hand', onRestart);
  again.dataset.role = 'restart';
  actions.append(pick, again);
  dock.appendChild(actions);
}
