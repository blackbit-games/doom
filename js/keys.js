// Doom engine key codes (from doomkeys.h in doomgeneric / Chocolate Doom).
export const KEY = {
  RIGHTARROW: 0xae,
  LEFTARROW: 0xac,
  UPARROW: 0xad,
  DOWNARROW: 0xaf,
  STRAFE_L: 0xa0,
  STRAFE_R: 0xa1,
  USE: 0xa2,
  FIRE: 0xa3,
  RSHIFT: 0x80 + 0x36,
  TAB: 9,
  ESCAPE: 27,
  ENTER: 13,
  F2: 0x80 + 0x3c,
  F3: 0x80 + 0x3d,
  F6: 0x80 + 0x40,
  F9: 0x80 + 0x43,
  DIGIT1: 49,
  DIGIT2: 50,
  DIGIT3: 51,
  DIGIT4: 52,
  DIGIT5: 53,
  DIGIT6: 54,
  DIGIT7: 55,
  DIGIT8: 56,
};

export function digitWeapon(n) {
  if (n < 1 || n > 8) return KEY.DIGIT1;
  return 48 + n;
}
