import { h } from '../../ui/dom';

export interface StickPosition { x: number; y: number }

/** Clamp the thumb to the ring, with a small neutral zone so resting fingers don't drift. */
export function stickPosition(x: number, y: number, radius: number): StickPosition {
  const distance = Math.hypot(x, y);
  if (radius <= 0 || distance < radius * 0.18) return { x: 0, y: 0 };
  const scale = Math.max(radius, distance);
  return { x: x / scale, y: y / scale };
}

export function createStick(label: string, kind: 'walk' | 'look', start: () => boolean, change: (position: StickPosition) => void) {
  const thumb = h('span.mobile-stick-thumb', { 'aria-hidden': true }, kind === 'look' ? '⌖' : '');
  const element = h('div.mobile-stick', { role: 'group', 'aria-label': label, 'data-stick': kind },
    h('span.mobile-stick-directions', { 'aria-hidden': true }, '⌃'),
    thumb,
    h('span.mobile-stick-label', { 'aria-hidden': true }, kind === 'walk' ? 'MOVER' : 'MIRAR'),
  );
  let pointer: number | null = null;

  function move(event: PointerEvent) {
    const bounds = element.getBoundingClientRect();
    const radius = bounds.width * 0.32;
    const position = stickPosition(event.clientX - bounds.x - bounds.width / 2, event.clientY - bounds.y - bounds.height / 2, radius);
    element.style.setProperty('--stick-x', `${position.x * radius}px`);
    element.style.setProperty('--stick-y', `${position.y * radius}px`);
    change(position);
  }
  function reset() {
    const id = pointer;
    pointer = null;
    element.classList.remove('held');
    element.style.setProperty('--stick-x', '0px');
    element.style.setProperty('--stick-y', '0px');
    change({ x: 0, y: 0 });
    if (id !== null && element.hasPointerCapture(id)) element.releasePointerCapture(id);
  }
  element.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (pointer !== null || !start()) return;
    pointer = event.pointerId;
    element.setPointerCapture(pointer);
    element.classList.add('held');
    move(event);
  });
  element.addEventListener('pointermove', (event) => {
    event.stopPropagation();
    if (event.pointerId === pointer) move(event);
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    element.addEventListener(name, (event) => { if (event.pointerId === pointer) reset(); });
  }
  element.addEventListener('contextmenu', (event) => event.preventDefault());
  return { element, reset };
}
