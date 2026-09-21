import './style.css';
import { Table } from './table';
import { analyze } from './solver';
import { renderRanks } from './ui-ranks';
import { renderSuits } from './ui-suits';
import { renderAnswer } from './ui-answer';
import type { Rank, Suit } from './types';

const root = document.querySelector<HTMLDivElement>('#app')!;

async function boot() {
  root.textContent = 'Loading…';
  const table = await Table.load(`${import.meta.env.BASE_URL}ddb96.bin`);
  start(table);
}

function start(table: Table) {
  renderRanks(root, (ranks: Rank[]) => {
    const unknown: (Suit | null)[] = [null, null, null, null, null];
    const a = analyze(table, ranks, unknown);
    if (a.kind === 'resolved') {
      renderAnswer(root, ranks, unknown, a.mask, a.evLow, a.evHigh, () => start(table));
    } else {
      renderSuits(root, table, ranks, (resolved, suits) => {
        renderAnswer(root, ranks, suits, resolved.mask,
          resolved.evLow, resolved.evHigh, () => start(table));
      }, () => start(table));
    }
  });
}

function showBootError(e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  root.replaceChildren();
  const p = document.createElement('p');
  p.textContent = `Failed to start: ${message}. This app needs one successful ` +
    'online load to install itself for offline use — check your connection and retry.';
  root.appendChild(p);
  const retry = document.createElement('button');
  retry.textContent = 'Retry';
  retry.addEventListener('click', () => { boot().catch(showBootError); });
  root.appendChild(retry);
}

boot().catch(showBootError);
