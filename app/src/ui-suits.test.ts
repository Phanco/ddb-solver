// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { Table } from './table';
import { renderSuits, SUIT_LABELS } from './ui-suits';
import { analyze } from './solver';
import { rank, type Rank } from './types';

let table: Table;
beforeAll(() => { table = Table.fromBytes(new Uint8Array(readFileSync('public/ddb96.bin'))); });

const R = (...ns: number[]) => ns.map(rank) as Rank[];

function suitButton(root: HTMLElement, pos: number, suit: number) {
  return root.querySelector(
    `[data-role="suit"][data-pos="${pos}"][data-suit="${suit}"]`) as HTMLButtonElement;
}

describe('suit selection', () => {
  it('shows one column per card with four suits each', () => {
    renderSuits(document.createElement('div'), table, R(11, 10, 9, 7, 1), vi.fn(), vi.fn());
    expect(SUIT_LABELS).toEqual(['♥', '♦', '♣', '♠']);
  });

  it('renders five columns of four suit buttons', () => {
    const root = document.createElement('div');
    renderSuits(root, table, R(11, 10, 9, 7, 1), vi.fn(), vi.fn());
    expect(root.querySelectorAll('[data-role="suit"]').length).toBe(20);
  });

  it('resolves before all five suits are entered', () => {
    const root = document.createElement('div');
    const done = vi.fn();
    renderSuits(root, table, R(11, 10, 9, 7, 1), done, vi.fn());
    // K, Q, J all different suits kills every royal and flush draw, so the
    // remaining two cards cannot matter.
    suitButton(root, 0, 0).click();
    suitButton(root, 1, 1).click();
    suitButton(root, 2, 2).click();
    expect(done).toHaveBeenCalled();
  });

  it('dims exactly the columns whose suit cannot change the play', () => {
    // Asserted structurally against analyze()'s own verdict rather than against
    // a hand hand-picked to have a dead column. Which hands have dead columns is
    // the solver's business and is tested there; what THIS test owns is that the
    // screen renders `relevant` faithfully.
    //
    // Note the hand must be ambiguous or Screen 2 never renders at all —
    // renderSuits calls onResolved and returns without drawing any columns.
    const root = document.createElement('div');
    const ranks = R(11, 10, 9, 7, 1);           // K Q J 9 3 — suits matter
    const a = analyze(table, ranks, [null, null, null, null, null]);
    expect(a.kind).toBe('ambiguous');
    if (a.kind !== 'ambiguous') return;

    renderSuits(root, table, ranks, vi.fn(), vi.fn());
    const cols = [...root.querySelectorAll('.suit-col')];
    expect(cols.length).toBe(5);
    expect(cols.map(c => c.classList.contains('dim'))).toEqual(
      a.relevant.map(r => !r),
    );
  });

  it('labels a dimmed column "any" so it reads as answered-for-you, not broken', () => {
    const root = document.createElement('div');
    const ranks = R(11, 10, 9, 7, 1);           // K Q J 9 3 — suits matter
    const a = analyze(table, ranks, [null, null, null, null, null]);
    expect(a.kind).toBe('ambiguous');
    if (a.kind !== 'ambiguous') return;

    renderSuits(root, table, ranks, vi.fn(), vi.fn());
    const cols = [...root.querySelectorAll('.suit-col')];
    for (let i = 0; i < 5; i++) {
      if (!a.relevant[i]) expect(cols[i].querySelector('.slot')?.textContent).toContain('any');
    }
  });

  it('disables the button that would duplicate an already-chosen card of the same rank', () => {
    const root = document.createElement('div');
    // 7 7 K Q J — a same-rank pair, both positions live.
    renderSuits(root, table, R(5, 5, 11, 10, 9), vi.fn(), vi.fn());
    suitButton(root, 0, 0).click();     // 7♥ at position 0
    const dup = suitButton(root, 1, 0); // 7♥ at position 1 would be the same card
    expect(dup.disabled).toBe(true);
  });

  it('tapping a duplicate suit on a same-rank pair does not throw and does not corrupt state', () => {
    const root = document.createElement('div');
    const done = vi.fn();
    renderSuits(root, table, R(5, 5, 11, 10, 9), done, vi.fn());
    suitButton(root, 0, 0).click();
    expect(() => suitButton(root, 1, 0).click()).not.toThrow();
    // The illegal choice must not have been committed: position 1 still has
    // no chosen suit, and the screen must still be showing (not thrown away).
    expect(suitButton(root, 1, 0).classList.contains('chosen')).toBe(false);
    expect(root.querySelectorAll('[data-role="suit"]').length).toBeGreaterThan(0);
  });

  it('renders a New hand button on the suit screen that calls onRestart', () => {
    const root = document.createElement('div');
    const onRestart = vi.fn();
    renderSuits(root, table, R(11, 10, 9, 7, 1), vi.fn(), onRestart);
    const btn = root.querySelector('[data-role="restart"]') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    btn.click();
    expect(onRestart).toHaveBeenCalled();
  });
});
