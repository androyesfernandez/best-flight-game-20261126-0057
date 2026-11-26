// input.js — keyboard and mouse state with one-shot action flags.
// Held keys are read every frame; actions fire once per press.

const ACTION_KEYS = {
  flap: 'KeyF',
  drop: 'KeyB',
  camera: 'KeyC',
  reset: 'KeyR',
  pause: 'KeyP',
  pauseAlt: 'Escape',
  mute: 'KeyM',
  start: 'Enter',
};

export function createInput() {
  const keys = new Set();
  const pressed = new Set(); // one-shot: consumed by take()
  let mouseX = 0.5;
  let mouseDown = false;
  let anyGesture = false;

  function onKeyDown(e) {
    if (e.repeat) return;
    keys.add(e.code);
    pressed.add(e.code);
    anyGesture = true;
    // Keep the game from scrolling on arrows / space.
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  }
  function onKeyUp(e) {
    keys.delete(e.code);
  }
  function onMouseMove(e) {
    mouseX = e.clientX / Math.max(1, window.innerWidth);
  }
  function onMouseDown() {
    mouseDown = true;
    anyGesture = true;
  }
  function onMouseUp() {
    mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    // Held-state queries used by the flight model.
    get throttleUp() { return keys.has('KeyW'); },
    get throttleDown() { return keys.has('KeyS'); },
    get pitchUp() { return keys.has('ArrowUp'); },
    get pitchDown() { return keys.has('ArrowDown'); },
    get rollLeft() { return keys.has('ArrowLeft'); },
    get rollRight() { return keys.has('ArrowRight'); },
    get yawLeft() { return keys.has('KeyA'); },
    get yawRight() { return keys.has('KeyD'); },
    get brake() { return keys.has('Space'); },
    get mouseDown() { return mouseDown; },
    get mouseX() { return mouseX; },
    get gesture() { return anyGesture; },
    // One-shot action: true once per physical press.
    take(action) {
      const code = ACTION_KEYS[action];
      if (!code) return false;
      if (action === 'pause') {
        const hit = pressed.has(ACTION_KEYS.pause) || pressed.has(ACTION_KEYS.pauseAlt);
        pressed.delete(ACTION_KEYS.pause);
        pressed.delete(ACTION_KEYS.pauseAlt);
        return hit;
      }
      const hit = pressed.has(code);
      pressed.delete(code);
      return hit;
    },
    // Sortie keys 1-8: returns the sortie number pressed, or 0.
    takeSortie() {
      for (let n = 1; n <= 8; n++) {
        const code = 'Digit' + n;
        if (pressed.has(code)) {
          pressed.delete(code);
          return n;
        }
      }
      return 0;
    },
    clearPressed() {
      pressed.clear();
    },
  };
}
