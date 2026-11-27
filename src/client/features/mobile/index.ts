import type { Ctx } from '../../core/context';
import { isTyping } from '../../player';
import { h, modalOpen, onModalChange } from '../../ui/dom';
import { createStick } from './stick';
import './ui.css';

const KEYS: Record<string, string> = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyE: 'e', Space: ' ' };
const TURN_SPEED = 1.65;

/** Touch controls use the same key path as the keyboard, including activity and interaction guards. */
export function installMobileControls(ctx: Ctx) {
  const touch = matchMedia('(pointer: coarse)');
  const root = h('div.mobile-controls', { role: 'group', 'aria-label': 'Controles táctiles 3D', hidden: true });
  const actions = h('div.mobile-actions');
  let focused = true;
  let look = { x: 0, y: 0 };
  const walking = new Set<string>();
  const held = new Map<number, { button: HTMLButtonElement; code: string }>();
  const allowed = () => focused && touch.matches && ctx.player.enabled && ctx.player.mouseLook && !ctx.trip() && !modalOpen() && !isTyping() && !document.hidden;
  const key = (type: 'keydown' | 'keyup', code: string) =>
    window.dispatchEvent(new KeyboardEvent(type, { code, key: KEYS[code], bubbles: true, cancelable: true }));
  function start() {
    if (!allowed()) return false;
    ctx.canvas.focus({ preventScroll: true });
    return true;
  }
  const walk = createStick('Joystick de movimiento', 'walk', start, ({ x, y }) => {
    const next = new Set<string>();
    if (y < -0.25) next.add('KeyW');
    if (y > 0.25) next.add('KeyS');
    if (x < -0.25) next.add('KeyA');
    if (x > 0.25) next.add('KeyD');
    for (const code of walking) if (!next.has(code)) key('keyup', code);
    for (const code of next) if (!walking.has(code)) key('keydown', code);
    walking.clear();
    for (const code of next) walking.add(code);
  });
  const camera = createStick('Joystick de cámara', 'look', start, (position) => { look = position; });
  root.append(walk.element, h('div.mobile-right', {}, actions, camera.element));
  document.getElementById('hud')!.append(root);

  function release(id: number) {
    const control = held.get(id);
    if (!control) return;
    held.delete(id);
    if (![...held.values()].some((other) => other.button === control.button)) control.button.classList.remove('held');
    if (![...held.values()].some((other) => other.code === control.code)) key('keyup', control.code);
    if (control.button.hasPointerCapture(id)) control.button.releasePointerCapture(id);
  }
  function clear() {
    walk.reset();
    camera.reset();
    for (const id of [...held.keys()]) release(id);
  }
  function button(label: string, symbol: string, caption: string, code: string) {
    const el = h('button.mobile-button', { type: 'button', 'aria-label': label, title: label },
      h('span.mobile-button-icon', { 'aria-hidden': true }, symbol),
      h('span.mobile-button-label', { 'aria-hidden': true }, caption),
    );
    el.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!start()) return;
      el.setPointerCapture(event.pointerId);
      held.set(event.pointerId, { button: el, code });
      el.classList.add('held');
      key('keydown', code);
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
      el.addEventListener(name, (event) => release(event.pointerId));
    }
    el.addEventListener('click', (event) => {
      if (event.detail === 0 && allowed()) { key('keydown', code); key('keyup', code); }
    });
    el.addEventListener('pointermove', (event) => event.stopPropagation());
    el.addEventListener('contextmenu', (event) => event.preventDefault());
    actions.append(el);
  }
  button('Interactuar', '✋︎', 'USAR', 'KeyE');
  button('Saltar', '⇧', 'SALTAR', 'Space');

  function sync() {
    const active = allowed();
    if (root.hidden === active) {
      root.hidden = !active;
      document.body.classList.toggle('mobile-controls-active', active);
    }
    if (!active && (walking.size || held.size || look.x || look.y || root.querySelector('.held'))) clear();
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
    const step = TURN_SPEED * Math.min(dt, 0.05);
    ctx.player.camYaw -= look.x * step;
    if (ctx.player.view === 'first') ctx.player.lookPitch = Math.max(-1.45, Math.min(1.45, ctx.player.lookPitch - look.y * step));
    else ctx.player.camPitch = Math.max(0.05, Math.min(1.3, ctx.player.camPitch + look.y * step));
  });
  sync();
}
