// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderRanks, RANK_LABELS } from './ui-ranks';
import { GAMES } from './games';

function tap(root: HTMLElement, label: string) {
  const b = [...root.querySelectorAll('button')]
    .find(b => b.textContent === label && b.dataset.role === 'rank') as HTMLButtonElement;
  if (!b) throw new Error(`no rank button ${label}`);
  b.click();
}

let root: HTMLElement;
beforeEach(() => { root = document.createElement('div'); });

describe('rank entry', () => {
  it('labels ranks two through ace', () => {
    expect(RANK_LABELS[0]).toBe('2');
    expect(RANK_LABELS[8]).toBe('T');
    expect(RANK_LABELS[12]).toBe('A');
  });

  it('fires on the fifth tap, with no Go button', () => {
    const done = vi.fn();
    renderRanks(root, GAMES.ddb, done, vi.fn());
    expect(root.querySelector('[data-role="go"]')).toBeNull();
    for (const l of ['A', 'K', 'Q', 'J']) tap(root, l);
    expect(done).not.toHaveBeenCalled();
    tap(root, '9');
    expect(done).toHaveBeenCalledOnce();
    expect(done.mock.calls[0][0]).toEqual([12, 11, 10, 9, 7]);
  });

  it('clears a slot when it is tapped', () => {
    renderRanks(root, GAMES.ddb, vi.fn(), vi.fn());
    tap(root, 'A'); tap(root, 'K');
    const slots = () => [...root.querySelectorAll('[data-role="slot"]')].map(s => s.textContent);
    expect(slots().slice(0, 2)).toEqual(['A', 'K']);
    (root.querySelector('[data-role="slot"]') as HTMLElement).click();
    expect(slots()[0]).toBe('K');
  });

  it('disables a rank after four of it are entered', () => {
    renderRanks(root, GAMES.ddb, vi.fn(), vi.fn());
    for (let i = 0; i < 4; i++) tap(root, '7');
    const seven = [...root.querySelectorAll('button')]
      .find(b => b.textContent === '7' && b.dataset.role === 'rank') as HTMLButtonElement;
    expect(seven.disabled).toBe(true);
  });

  it('offers a game switch on the rank screen', () => {
    const switched = vi.fn();
    renderRanks(root, GAMES.ddb, vi.fn(), switched);
    const sw = root.querySelector('[data-role="game"]') as HTMLButtonElement;
    expect(sw).not.toBeNull();
    expect(sw.textContent).toContain('Deuces Wild');   // names where it goes
    sw.click();
    expect(switched).toHaveBeenCalledWith('deuces');
  });

  it('switches back the other way', () => {
    const switched = vi.fn();
    renderRanks(root, GAMES.deuces, vi.fn(), switched);
    const sw = root.querySelector('[data-role="game"]') as HTMLButtonElement;
    expect(sw.textContent).toContain('Double Double Bonus');
    sw.click();
    expect(switched).toHaveBeenCalledWith('ddb');
  });
});
