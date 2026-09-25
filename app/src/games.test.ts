// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { GAMES, GAME_IDS, currentGame, setGame, otherGame } from './games';

beforeEach(() => { try { localStorage.clear(); } catch { /* private mode */ } });

describe('games', () => {
  it('describes both games with distinct tables', () => {
    expect(GAME_IDS).toEqual(['ddb', 'deuces']);
    expect(GAMES.ddb.table).toBe('ddb96.bin');
    expect(GAMES.deuces.table).toBe('illinois-deuces.bin');
    expect(GAMES.ddb.returnPct).toBe('98.98%');
    expect(GAMES.deuces.returnPct).toBe('98.91%');
  });

  it('defaults to double double bonus', () => {
    expect(currentGame().id).toBe('ddb');
  });

  it('remembers the chosen game', () => {
    setGame('deuces');
    expect(currentGame().id).toBe('deuces');
  });

  it('falls back to the default when storage holds something unknown', () => {
    localStorage.setItem('ddb.game', 'roulette');
    expect(currentGame().id).toBe('ddb');
  });

  it('toggles to the other game', () => {
    expect(otherGame(GAMES.ddb).id).toBe('deuces');
    expect(otherGame(GAMES.deuces).id).toBe('ddb');
  });
});
