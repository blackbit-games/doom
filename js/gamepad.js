import { KEY, digitWeapon } from './keys.js';

// Standard Gamepad mapping (Xbox, PlayStation via the browser's Standard Gamepad).
// Vanilla Doom has no free-look, so the right stick only turns left/right.

export const GAMEPAD_LAYOUT = [
  'Linker Stick: laufen / seitlich gehen',
  'Rechter Stick: umsehen (drehen)',
  'LT / L2 oder L3: rennen',
  'RT / R2: schießen',
  'A / Kreuz: benutzen (Tür, Schalter), im Menü auswählen',
  'LB / L1 oder X / Quadrat: vorherige Waffe',
  'RB / R1 oder Y / Dreieck: nächste Waffe',
  'Select / Back / Share: Karte',
  'Start / Options: Menü',
  'D-Pad: laufen und drehen',
];

export const BUTTON = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  SELECT: 8,
  START: 9,
  L3: 10,
  R3: 11,
  DUP: 12,
  DDOWN: 13,
  DLEFT: 14,
  DRIGHT: 15,
};

const DEADZONE = 0.28;
const TRIGGER = 0.35;

function axisDir(value, neg, pos) {
  if (value <= -DEADZONE) return neg;
  if (value >= DEADZONE) return pos;
  return null;
}

export function keysFromGamepad(pad, state = {}, maxWeapon = 8) {
  const weaponSlot = state.weaponSlot || 1;
  const buttons = pad.buttons || [];
  const axes = pad.axes || [];
  const pressed = new Set();
  const down = (i) => {
    const b = buttons[i];
    if (b == null) return false;
    return typeof b === 'object' ? !!(b.pressed || b.value >= TRIGGER) : !!b;
  };

  const lx = axes[0] || 0;
  const ly = axes[1] || 0;
  const rx = axes[2] || 0;

  const moveX = axisDir(lx, KEY.STRAFE_L, KEY.STRAFE_R);
  const moveY = axisDir(ly, KEY.UPARROW, KEY.DOWNARROW);
  const turnX = axisDir(rx, KEY.LEFTARROW, KEY.RIGHTARROW);
  if (moveX) pressed.add(moveX);
  if (moveY) pressed.add(moveY);
  if (turnX) pressed.add(turnX);

  if (down(BUTTON.DUP)) pressed.add(KEY.UPARROW);
  if (down(BUTTON.DDOWN)) pressed.add(KEY.DOWNARROW);
  if (down(BUTTON.DLEFT)) pressed.add(KEY.LEFTARROW);
  if (down(BUTTON.DRIGHT)) pressed.add(KEY.RIGHTARROW);

  if (down(BUTTON.RT)) pressed.add(KEY.FIRE);
  // A / Cross: use in game, and confirm in menus (Doom menus need Enter, prompts need 'y').
  if (down(BUTTON.A)) {
    pressed.add(KEY.USE);
    pressed.add(KEY.ENTER);
    pressed.add(KEY.YES);
  }
  if (down(BUTTON.LT) || down(BUTTON.L3)) pressed.add(KEY.RSHIFT);
  if (down(BUTTON.SELECT) || down(BUTTON.R3)) pressed.add(KEY.TAB);
  if (down(BUTTON.START)) pressed.add(KEY.ESCAPE);
  // B / Circle also backs out of menus.
  if (down(BUTTON.B)) pressed.add(KEY.ESCAPE);

  const nextHeld = down(BUTTON.RB) || down(BUTTON.Y);
  const prevHeld = down(BUTTON.LB) || down(BUTTON.X);
  if (nextHeld) pressed.add(KEY.NEXTWEAPON);
  else if (prevHeld) pressed.add(KEY.PREVWEAPON);

  return {
    pressed,
    state: { weaponSlot, nextHeld, prevHeld },
  };
}

export function diffKeys(prev, next) {
  const downs = [];
  const ups = [];
  for (const k of next) if (!prev.has(k)) downs.push(k);
  for (const k of prev) if (!next.has(k)) ups.push(k);
  return { downs, ups };
}

export function isMeaningfulPad(pad) {
  if (!pad) return false;
  const buttons = pad.buttons || [];
  const axes = pad.axes || [];
  if (buttons.length < 8 || axes.length < 2) return false;
  return true;
}
