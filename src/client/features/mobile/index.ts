import type { Ctx } from '../../core/context';
import { isTyping } from '../../player';
import { h, modalOpen, onModalChange } from '../../ui/dom';
import './ui.css';

const KEYS: Record<string, string> = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyE: 'e', Space: ' ' };
const TURN_SPEED = 1.65;

/** Touch controls use the same key path as the keyboard, including activity and interaction guards. */
export function installMobileControls(ctx: Ctx) {
  const touch = matchMedia('(pointer: coarse)');
  const root = h('div.mobile-controls', { role: 'group', 'aria-label': 'Controles táctiles 3D', hidden: true });
  const walk = h('div.mobile-pad', { 'aria-label': 'Desplazamiento' });
  const camera = h('div.mobile-pad', { 'aria-label': 'Cámara' });
  const actions = h('div.mobile-actions');
  const right = h('div.mobile-right', {}, actions, camera);
  root.append(walk, right);
  document.getElementById('hud')!.append(root);

  let focused = true;
  const held = new Map<number, { button: HTMLButtonElement; code?: string; x: number; y: number }>();
  const allowed = () => focused && touch.matches && ctx.player.enabled && ctx.player.mouseLook && !ctx.trip() && !modalOpen() && !isTyping() && !document.hidden;
  const key = (type: 'keydown' | 'keyup', code: string) =>
    window.dispatchEvent(new KeyboardEvent(type, { code, key: KEYS[code], bubbles: true, cancelable: true }));

  function release(id: number) {
    const control = held.get(id);
    if (!control) return;
    held.delete(id);
    if (![...held.values()].some((other) => other.button === control.button)) control.button.classList.remove('held');
    if (control.code && ![...held.values()].some((other) => other.code === control.code)) key('keyup', control.code);
    if (control.button.hasPointerCapture(id)) control.button.releasePointerCapture(id);
  }
  function clear() {
    for (const id of [...held.keys()]) release(id);
  }
  function button(parent: HTMLElement, label: string, symbol: string, place: string, code?: string, x = 0, y = 0) {
    const el = h('button.mobile-button', { type: 'button', 'aria-label': label, title: label, style: place }, symbol);
    el.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!allowed()) return;
      ctx.canvas.focus({ preventScroll: true });
      el.setPointerCapture(event.pointerId);
      held.set(event.pointerId, { button: el, code, x, y });
      el.classList.add('held');
      if (code) key('keydown', code);
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
      el.addEventListener(name, (event) => release(event.pointerId));
    }
    el.addEventListener('click', (event) => {
      if (event.detail === 0 && code && allowed()) { key('keydown', code); key('keyup', code); }
    });
    // A moving control finger must never rotate a camera drag held by another finger.
    el.addEventListener('pointermove', (event) => event.stopPropagation());
    el.addEventListener('contextmenu', (event) => event.preventDefault());
    parent.append(el);
  }
  button(walk, 'Avanzar', '↑', 'grid-area:1 / 2', 'KeyW');
  button(walk, 'Izquierda', '←', 'grid-area:2 / 1', 'KeyA');
  button(walk, 'Retroceder', '↓', 'grid-area:2 / 2', 'KeyS');
  button(walk, 'Derecha', '→', 'grid-area:2 / 3', 'KeyD');
  button(camera, 'Mirar arriba', '⌃', 'grid-area:1 / 2', undefined, 0, 1);
  button(camera, 'Girar a la izquierda', '↶', 'grid-area:2 / 1', undefined, 1, 0);
  button(camera, 'Mirar abajo', '⌄', 'grid-area:2 / 2', undefined, 0, -1);
  button(camera, 'Girar a la derecha', '↷', 'grid-area:2 / 3', undefined, -1, 0);
  button(actions, 'Interactuar', 'Usar', '', 'KeyE');
  button(actions, 'Saltar', 'Saltar', '', 'Space');

  function sync() {
    const active = allowed();
    if (root.hidden === active) {
      root.hidden = !active;
      document.body.classList.toggle('mobile-controls-active', active);
    }
    if (!active) clear();
  }
  touch.addEventListener('change', sync);
  onModalChange(sync);
  window.addEventListener('blur', () => { focused = false; sync(); });
  window.addEventListener('focus', () => { focused = true; sync(); });
  window.addEventListener('pagehide', clear);
  window.addEventListener('orientationchange', clear);
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('focusin', sync);
  ctx.windowOpened.add(clear);
  ctx.ticks.add('pre', ({ dt }) => {
    sync();
    if (root.hidden) return;
    let x = 0, y = 0;
    for (const control of held.values()) { x += control.x; y += control.y; }
    const step = TURN_SPEED * Math.min(dt, 0.05);
    ctx.player.camYaw += x * step;
    if (ctx.player.view === 'first') ctx.player.lookPitch = Math.max(-1.45, Math.min(1.45, ctx.player.lookPitch + y * step));
    else ctx.player.camPitch = Math.max(0.05, Math.min(1.3, ctx.player.camPitch - y * step));
  });
  sync();
}
