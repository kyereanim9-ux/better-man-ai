// Shared timing helpers: every value is a pure function of t.
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const span = (t, start, dur) => clamp((t - start) / dur);
export const out3 = (x) => 1 - Math.pow(1 - clamp(x), 3);
export const out5 = (x) => 1 - Math.pow(1 - clamp(x), 5);
export const inOut = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const lerp = (a, b, p) => a + (b - a) * p;

// Fade up from below, starting at `start`.
export function rise(el, t, start, dur = 0.9, dist = 48) {
  const p = out5(span(t, start, dur));
  el.style.opacity = p;
  el.style.transform = `translateY(${(1 - p) * dist}px)`;
}

// Edge fades so cuts between shots breathe: veil covers the picture at both ends.
export function edges(veil, t, duration, fin = 0.35, fout = 0.35) {
  const a = 1 - span(t, 0, fin);
  const b = span(t, duration - fout, fout);
  veil.style.opacity = Math.max(a, b);
}

// Slow drifting light behind everything.
export function drift(glow, t, x0, y0, dx = 120, dy = 60) {
  glow.style.left = `${x0 + Math.sin(t * 0.35) * dx - 700}px`;
  glow.style.top = `${y0 + Math.cos(t * 0.28) * dy - 700}px`;
}

export function loaded() {
  const imgs = [...document.images].map((i) => i.decode().catch(() => {}));
  return Promise.all([document.fonts.ready, ...imgs, ...[400, 500, 600, 700, 800].map((w) => document.fonts.load(`${w} 40px "Inter Display"`))]);
}
