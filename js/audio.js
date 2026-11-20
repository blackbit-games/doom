export function unlockAudio(module) {
  const contexts = [];
  const sdl = module && module.SDL2 && module.SDL2.audioContext;
  if (sdl) contexts.push(sdl);
  if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
    // Resume any already-created contexts by walking the SDL2 hook.
  }
  for (const ctx of contexts) {
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }
  // Silent buffer kicks iOS audio into life after a user gesture.
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      const ctx = sdl || new AC();
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    }
  } catch {
    // Audio remains click-to-start.
  }
}
