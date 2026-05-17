// EPS-style call chime using WebAudio (no asset needed)
export function playCallChime() {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const notes = [880, 1175, 880]; // ding-dong-ding (EPS-ish)
    const now = ctx.currentTime;
    notes.forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      const start = now + i * 0.35;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.35, start + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
      o.connect(g).connect(ctx.destination);
      o.start(start);
      o.stop(start + 0.34);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {
    /* ignore */
  }
}
