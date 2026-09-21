// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderAnswer } from './ui-answer';
import { rank, entryMask, type Rank } from './types';

const R = (...ns: number[]) => ns.map(rank) as Rank[];

describe('answer screen', () => {
  it('lights the held slots and dims the rest', () => {
    const root = document.createElement('div');
    renderAnswer(root, R(12, 11, 10, 5, 1), [null,null,null,null,null],
      entryMask(0b00111), 2.5, 2.5, vi.fn());
    const cards = [...root.querySelectorAll('.card')];
    expect(cards.map(c => c.classList.contains('hold')))
      .toEqual([true, true, true, false, false]);
  });

  it('never names a rank in the instruction, only positions', () => {
    const root = document.createElement('div');
    renderAnswer(root, R(5, 5, 11, 10, 9), [0, 1, 0, 0, 0],
      entryMask(0b11101), 1.9, 1.9, vi.fn());
    const text = root.querySelector('[data-role="instruction"]')!.textContent!;
    expect(text).toMatch(/1, 3, 4, 5/);
    expect(text).not.toMatch(/\b7\b/);
  });

  it('shows a range when the EV was not pinned down', () => {
    const root = document.createElement('div');
    renderAnswer(root, R(12, 11, 10, 5, 1), [null,null,null,null,null],
      entryMask(0b00111), 2.41, 2.67, vi.fn());
    expect(root.querySelector('[data-role="ev"]')!.textContent).toMatch(/2\.41.*2\.67/);
  });

  it('restarts when the new-hand button is tapped', () => {
    const root = document.createElement('div');
    const restart = vi.fn();
    renderAnswer(root, R(12,11,10,5,1), [null,null,null,null,null],
      entryMask(0b00111), 2.5, 2.5, restart);
    (root.querySelector('[data-role="restart"]') as HTMLButtonElement).click();
    expect(restart).toHaveBeenCalledOnce();
  });
});
