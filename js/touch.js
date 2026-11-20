import { KEY, digitWeapon } from './keys.js';

export function mountTouch(root, inject, options) {
  const state = { weapon: 1, held: new Set() };

  const hold = (key) => {
    const onDown = (event) => {
      event.preventDefault();
      if (!state.held.has(key)) {
        state.held.add(key);
        inject(1, key);
      }
    };
    const onUp = (event) => {
      event.preventDefault();
      if (state.held.has(key)) {
        state.held.delete(key);
        inject(0, key);
      }
    };
    return { onDown, onUp };
  };

  const bindHold = (el, key) => {
    const { onDown, onUp } = hold(key);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('pointerleave', onUp);
  };

  const bindTap = (el, fn) => {
    el.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      fn();
    });
  };

  bindHold(root.querySelector('[data-key="fire"]'), KEY.FIRE);
  bindHold(root.querySelector('[data-key="use"]'), KEY.USE);
  bindHold(root.querySelector('[data-key="run"]'), KEY.RSHIFT);
  bindHold(root.querySelector('[data-key="map"]'), KEY.TAB);
  bindHold(root.querySelector('[data-key="menu"]'), KEY.ESCAPE);

  bindTap(root.querySelector('[data-key="prev"]'), () => {
    inject(1, KEY.PREVWEAPON);
    setTimeout(() => inject(0, KEY.PREVWEAPON), 120);
  });
  bindTap(root.querySelector('[data-key="next"]'), () => {
    inject(1, KEY.NEXTWEAPON);
    setTimeout(() => inject(0, KEY.NEXTWEAPON), 120);
  });

  const sticks = [
    {
      el: root.querySelector('.stick.left'),
      knob: root.querySelector('.stick.left .knob'),
      axes: (x, y, keys) => {
        if (x < -0.35) keys.add(KEY.STRAFE_L);
        if (x > 0.35) keys.add(KEY.STRAFE_R);
        if (y < -0.35) keys.add(KEY.UPARROW);
        if (y > 0.35) keys.add(KEY.DOWNARROW);
      },
    },
    {
      el: root.querySelector('.stick.right'),
      knob: root.querySelector('.stick.right .knob'),
      axes: (x, _y, keys) => {
        if (x < -0.35) keys.add(KEY.LEFTARROW);
        if (x > 0.35) keys.add(KEY.RIGHTARROW);
      },
    },
  ];

  const stickHeld = new Set();

  const applyStickKeys = (next) => {
    for (const key of next) {
      if (!stickHeld.has(key)) inject(1, key);
    }
    for (const key of stickHeld) {
      if (!next.has(key)) inject(0, key);
    }
    stickHeld.clear();
    for (const key of next) stickHeld.add(key);
  };

  const active = new Map();

  const setKnob = (stick, x, y) => {
    const r = stick.el.getBoundingClientRect();
    const max = r.width / 2 - 8;
    const dx = x * max;
    const dy = y * max;
    stick.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  };

  const read = (stick, event) => {
    const r = stick.el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const x = (event.clientX - cx) / (r.width / 2);
    const y = (event.clientY - cy) / (r.height / 2);
    const mag = Math.min(1, Math.hypot(x, y));
    const nx = mag ? (x / Math.hypot(x, y)) * mag : 0;
    const ny = mag ? (y / Math.hypot(x, y)) * mag : 0;
    return { x: nx, y: ny };
  };

  const recompute = () => {
    const keys = new Set();
    for (const stick of sticks) {
      const pos = stick.pos || { x: 0, y: 0 };
      stick.axes(pos.x, pos.y, keys);
    }
    applyStickKeys(keys);
  };

  for (const stick of sticks) {
    stick.el.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      stick.el.setPointerCapture(event.pointerId);
      active.set(event.pointerId, stick);
      stick.pos = read(stick, event);
      setKnob(stick, stick.pos.x, stick.pos.y);
      recompute();
    });
    stick.el.addEventListener('pointermove', (event) => {
      if (!active.has(event.pointerId)) return;
      stick.pos = read(stick, event);
      setKnob(stick, stick.pos.x, stick.pos.y);
      recompute();
    });
    const end = (event) => {
      if (!active.has(event.pointerId)) return;
      active.delete(event.pointerId);
      stick.pos = { x: 0, y: 0 };
      setKnob(stick, 0, 0);
      recompute();
    };
    stick.el.addEventListener('pointerup', end);
    stick.el.addEventListener('pointercancel', end);
  }

  return {
    setWeapon(n) { state.weapon = n; },
    releaseAll() {
      for (const key of [...state.held, ...stickHeld]) inject(0, key);
      state.held.clear();
      stickHeld.clear();
    },
  };
}
