import test from 'node:test';
import assert from 'node:assert/strict';
import { stickPosition } from '../src/client/features/mobile/stick.js';

test('a joystick stays neutral near the center and cannot travel past its ring', () => {
  assert.deepEqual(stickPosition(2, -2, 40), { x: 0, y: 0 });
  assert.deepEqual(stickPosition(100, 0, 40), { x: 1, y: 0 });
  assert.deepEqual(stickPosition(0, -100, 40), { x: 0, y: -1 });
  assert.deepEqual(stickPosition(10, 10, 0), { x: 0, y: 0 });
});

test('sliding a thumb preserves diagonal directions and reverses without releasing', () => {
  const diagonal = stickPosition(40, -40, 40);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-10);
  assert.ok(diagonal.x > 0 && diagonal.y < 0);
  assert.deepEqual(stickPosition(-40, 0, 40), { x: -1, y: 0 });
  assert.deepEqual(stickPosition(40, 0, 40), { x: 1, y: 0 });
});
