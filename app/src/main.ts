import './style.css';
import { Table } from './table';
import { analyze } from './solver';
import { describeBranches } from './branches';
import { renderRanks } from './ui-ranks';
import { renderSuits } from './ui-suits';
import { renderAnswer } from './ui-answer';
import { renderReadout } from './ui-readout';
import { applyHand, button, el, shell } from './ui-shell';
import type { Rank, Suit } from './types';

const root = document.querySelector<HTMLDivElement>('#app')!;
const UNKNOWN: (Suit | null)[] = [null, null, null, null, null];

async function boot() {
  applyHand();
  const { stage } = shell(root);
  stage.appendChild(el('p', 'caption', 'Loading…'));
  const table = await Table.load(`${import.meta.env.BASE_URL}ddb96.bin`);
  start(table);
}

function start(table: Table) {
  const restart = () => start(table);

  renderRanks(root, (ranks: Rank[]) => {
    const a = analyze(table, ranks, UNKNOWN);

    if (a.kind === 'resolved') {
      renderAnswer(root, ranks, UNKNOWN, a.mask, a.evLow, a.evHigh, restart);
      return;
    }

    const suitScreen = () => renderSuits(root, table, ranks, (resolved, suits) => {
      renderAnswer(root, ranks, suits, resolved.mask, resolved.evLow, resolved.evHigh, restart);
    }, restart);

    // When the whole hand turns on one suit question, say so instead of asking:
    // reading one line beats three taps. "Pick suits" stays available, because
    // scanning four cards for a shared suit is not always the faster route.
    const b = describeBranches(table, ranks);
    if (b) renderReadout(root, ranks, b, suitScreen, restart);
    else suitScreen();
  });
}

function showBootError(e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  const { stage, dock } = shell(root);
  stage.appendChild(el('p', 'verdict', 'Could not start'));
  stage.appendChild(el(
    'p',
    'caption',
    `${message}. This app needs one successful online load to install itself ` +
    'for offline use — check your connection and retry.',
  ));
  dock.appendChild(button('primary', 'Retry', () => { boot().catch(showBootError); }));
}

boot().catch(showBootError);
