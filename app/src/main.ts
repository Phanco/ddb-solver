import './style.css';
import { Table } from './table';
import { analyze } from './solver';
import { describeBranches } from './branches';
import { GAMES, currentGame, otherGame, setGame, type Game, type GameId } from './games';
import { renderRanks } from './ui-ranks';
import { renderSuits } from './ui-suits';
import { renderAnswer } from './ui-answer';
import { renderReadout } from './ui-readout';
import { applyHand, button, el, shell } from './ui-shell';
import type { Rank, Suit } from './types';

const root = document.querySelector<HTMLDivElement>('#app')!;
const UNKNOWN: (Suit | null)[] = [null, null, null, null, null];

/** One loaded table per game, so switching back is instant. */
const loaded = new Map<GameId, Table>();

async function tableFor(game: Game): Promise<Table> {
  const cached = loaded.get(game.id);
  if (cached) return cached;
  const t = await Table.load(`${import.meta.env.BASE_URL}${game.table}`);
  loaded.set(game.id, t);
  return t;
}

async function boot(game: Game): Promise<void> {
  applyHand();
  const { stage } = shell(root);
  stage.appendChild(el('p', 'caption', 'Loading…'));
  const table = await tableFor(game);
  start(game, table);
}

function start(game: Game, table: Table) {
  const restart = () => start(game, table);

  // Load first, commit second: the game the player is looking at must never
  // change until its table is actually in hand. The in-memory selection
  // (`next`, from `id`) is authoritative for this session; `setGame` is only
  // a best-effort attempt to remember the choice for next launch, and its
  // failure (private mode, blocked storage) must not stop the switch.
  const switchTo = async (id: GameId) => {
    const next = GAMES[id];
    let nextTable: Table;
    try {
      nextTable = await tableFor(next);
    } catch (e) {
      showSwitchError(game, table, next, e);
      return;
    }
    setGame(id);
    start(next, nextTable);
  };

  renderRanks(root, game, (ranks: Rank[]) => {
    const a = analyze(table, ranks, UNKNOWN);

    if (a.kind === 'resolved') {
      renderAnswer(root, game, ranks, UNKNOWN, a.mask, a.evLow, a.evHigh, restart);
      return;
    }

    const suitScreen = () => renderSuits(root, game, table, ranks, (resolved, suits) => {
      renderAnswer(root, game, ranks, suits, resolved.mask,
        resolved.evLow, resolved.evHigh, restart);
    }, restart);

    // When the whole hand turns on one suit question, say so instead of asking:
    // reading one line beats three taps. "Pick suits" stays available, because
    // scanning four cards for a shared suit is not always the faster route.
    const b = describeBranches(table, ranks);
    if (b) renderReadout(root, game, ranks, b, suitScreen, restart);
    else suitScreen();
  }, switchTo);
}

/** The switch attempt failed. The old game — already loaded, already
 * running — keeps its table; only an acknowledgement is needed to redraw it. */
function showSwitchError(from: Game, table: Table, attempted: Game, e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  const { stage, dock } = shell(root);
  stage.appendChild(el('p', 'verdict', 'Could not switch games'));
  stage.appendChild(el(
    'p',
    'caption',
    `${attempted.label} failed to load (${message}). Still on ${from.label}.`,
  ));
  dock.appendChild(button('primary', `Back to ${from.label}`, () => start(from, table)));
}

function showBootError(game: Game, e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  const { stage, dock } = shell(root);
  stage.appendChild(el('p', 'verdict', 'Could not start'));

  // Only true on a first launch with nothing cached yet — once any table has
  // loaded this session, the app is already installed for offline use, and
  // saying otherwise here would be false.
  const neverLoaded = loaded.size === 0;
  const copy = neverLoaded
    ? `${message}. This app needs one successful online load to install itself ` +
      'for offline use — check your connection and retry.'
    : `${message}. ${game.label} could not be loaded.`;
  stage.appendChild(el('p', 'caption', copy));

  dock.appendChild(button('primary', 'Retry', () => {
    boot(game).catch(e2 => showBootError(game, e2));
  }));

  // Escape hatch: this screen is reachable any time a load fails, not just on
  // first launch, so a user stuck here must have a way out that is not
  // "clear site data".
  const next = otherGame(game);
  const cached = loaded.get(next.id);
  dock.appendChild(button('ghost', `Switch to ${next.label}`, () => {
    if (cached) { start(next, cached); return; }
    boot(next).catch(e2 => showBootError(next, e2));
  }));
}

const initialGame = currentGame();
boot(initialGame).catch(e => showBootError(initialGame, e));
