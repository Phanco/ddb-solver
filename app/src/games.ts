export type GameId = 'ddb' | 'deuces';

export interface Game {
  id: GameId;
  /** Full name, for the rank screen where there is room. */
  label: string;
  /** Short name, for the answer screen where it sits beside the verdict. */
  short: string;
  table: string;
  returnPct: string;
}

export const GAMES: Record<GameId, Game> = {
  ddb: {
    id: 'ddb',
    label: 'Double Double Bonus',
    short: 'DDB',
    table: 'ddb96.bin',
    returnPct: '98.98%',
  },
  deuces: {
    id: 'deuces',
    label: 'Deuces Wild',
    short: 'Deuces',
    table: 'illinois-deuces.bin',
    returnPct: '98.91%',
  },
};

export const GAME_IDS = ['ddb', 'deuces'] as const satisfies readonly GameId[];

const KEY = 'ddb.game';
const DEFAULT: GameId = 'ddb';

export function currentGame(): Game {
  try {
    const stored = localStorage.getItem(KEY);
    if ((GAME_IDS as readonly string[]).includes(stored ?? '')) return GAMES[stored as GameId];
  } catch { /* private mode */ }
  return GAMES[DEFAULT];
}

export function setGame(id: GameId): void {
  try { localStorage.setItem(KEY, id); } catch { /* private mode */ }
}

export function otherGame(g: Game): Game {
  return g.id === 'ddb' ? GAMES.deuces : GAMES.ddb;
}
