/**
 * Every screen is the same two-part shell: a stage that reports state, and a
 * dock pinned to the bottom edge that holds every control. Nothing
 * interactive is allowed above the dock — on a 21:9 cover display the top of
 * the screen cannot be reached with the thumb of the hand holding the phone.
 */

export interface Shell {
  /** Reports state. Never holds controls. */
  stage: HTMLElement;
  /** Thumb zone. Holds every control on the screen. */
  dock: HTMLElement;
}

const HAND_KEY = 'ddb.hand';

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function button(className: string, text: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', className, text);
  b.addEventListener('click', onClick);
  return b;
}

function readHand(): 'right' | 'left' {
  try {
    return localStorage.getItem(HAND_KEY) === 'left' ? 'left' : 'right';
  } catch {
    return 'right';
  }
}

export function applyHand(): void {
  document.documentElement.dataset.hand = readHand();
}

/**
 * Only offered once the screen is wide enough for it to mean anything — on the
 * cover display the dock spans the full width and there is no side to pick.
 */
export function handToggle(onChange: () => void): HTMLButtonElement | null {
  if (typeof window.matchMedia !== 'function') return null;
  if (!window.matchMedia('(min-width: 40rem)').matches) return null;
  const current = readHand();
  const next = current === 'right' ? 'left' : 'right';
  return button('hand-toggle', `Move controls ${next}`, () => {
    try { localStorage.setItem(HAND_KEY, next); } catch { /* private mode */ }
    applyHand();
    onChange();
  });
}

export function shell(root: HTMLElement): Shell {
  applyHand();
  root.replaceChildren();

  const stage = el('div', 'stage');
  const stageInner = el('div', 'stage-inner');
  stage.appendChild(stageInner);

  const dock = el('div', 'dock');
  const dockInner = el('div', 'dock-inner');
  dock.appendChild(dockInner);

  root.append(stage, dock);
  return { stage: stageInner, dock: dockInner };
}
