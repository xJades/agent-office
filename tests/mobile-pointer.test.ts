import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PlayerController } from '../src/client/player/index.js';

test('a second finger cannot move or end the scene finger camera drag', (t) => {
  const win = new EventTarget(), doc = new EventTarget(), canvas = new EventTarget();
  for (const [name, value] of [['window', win], ['document', doc]] as const) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => previous ? Object.defineProperty(globalThis, name, previous) : Reflect.deleteProperty(globalThis, name));
  }
  const player = new PlayerController(new THREE.PerspectiveCamera(), canvas as unknown as HTMLElement, []);
  const pointer = (target: EventTarget, type: string, id: number, x: number) => {
    const event = new Event(type);
    for (const [name, value] of Object.entries({ pointerId: id, pointerType: 'touch', clientX: x, clientY: 0 })) {
      Object.defineProperty(event, name, { value });
    }
    target.dispatchEvent(event);
  };
  pointer(canvas, 'pointerdown', 1, 0);
  const yaw = player.camYaw;
  pointer(win, 'pointermove', 2, 100);
  assert.equal(player.camYaw, yaw);
  pointer(win, 'pointerup', 2, 100);
  pointer(win, 'pointermove', 1, 10);
  assert.notEqual(player.camYaw, yaw, 'releasing a control finger must leave scene dragging active');
  const moved = player.camYaw;
  pointer(win, 'pointercancel', 1, 10);
  pointer(win, 'pointermove', 1, 20);
  assert.equal(player.camYaw, moved, 'cancelled scene touch must stop rotating');
});

test('touch screens never request mouse pointer lock when a window closes', (t) => {
  const win = new EventTarget(), doc = new EventTarget(), canvas = new EventTarget();
  let coarse = true;
  Object.assign(win, { matchMedia: () => ({ matches: coarse }) });
  Object.assign(canvas, { requestPointerLock: () => undefined });
  for (const [name, value] of [['window', win], ['document', doc]] as const) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => previous ? Object.defineProperty(globalThis, name, previous) : Reflect.deleteProperty(globalThis, name));
  }
  const player = new PlayerController(new THREE.PerspectiveCamera(), canvas as unknown as HTMLElement, []);
  assert.equal(player.canLock, false);
  coarse = false;
  assert.equal(player.canLock, true, 'desktop mouse lock stays available');
});
