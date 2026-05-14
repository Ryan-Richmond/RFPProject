/**
 * Lightweight DOM confetti — no canvas, no deps.
 * Triggers a brief shower of colored particles from the top of the viewport.
 * Used for milestone moments: first high-fit opportunity, first proposal generated,
 * first export, etc.
 */

const COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#22c55e", // success green
  "#f59e0b", // amber
  "#ec4899", // pink
];

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface CelebrateOptions {
  particleCount?: number;
  durationMs?: number;
}

let activeCelebration: HTMLDivElement | null = null;

export function celebrate(opts: CelebrateOptions = {}): void {
  if (typeof window === "undefined" || prefersReducedMotion()) return;

  const particleCount = opts.particleCount ?? 90;
  const durationMs = opts.durationMs ?? 2400;

  // Remove any in-flight celebration so we don't stack.
  if (activeCelebration) {
    activeCelebration.remove();
    activeCelebration = null;
  }

  const container = document.createElement("div");
  container.setAttribute("aria-hidden", "true");
  container.style.cssText = `
    position: fixed;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
    z-index: 9999;
  `;

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement("span");
    const left = Math.random() * 100;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const delay = Math.random() * 250;
    const drift = (Math.random() - 0.5) * 40; // px horizontal drift
    const rotateStart = Math.random() * 360;
    const rotateEnd = rotateStart + (Math.random() * 720 - 360);
    const fallDuration = 1400 + Math.random() * 1000;
    const size = 6 + Math.random() * 8;
    const shape = Math.random() > 0.5 ? "50%" : "2px";

    particle.style.cssText = `
      position: absolute;
      top: -10vh;
      left: ${left}%;
      width: ${size}px;
      height: ${size * (Math.random() > 0.5 ? 1 : 0.4)}px;
      background: ${color};
      border-radius: ${shape};
      opacity: 0;
      transform: translate(0, 0) rotate(${rotateStart}deg);
      animation: pp-confetti-fall ${fallDuration}ms cubic-bezier(0.3, 0.7, 0.4, 1) ${delay}ms forwards;
      --pp-confetti-drift: ${drift}px;
      --pp-confetti-rotate-end: ${rotateEnd}deg;
    `;

    container.appendChild(particle);
  }

  document.body.appendChild(container);
  activeCelebration = container;

  window.setTimeout(() => {
    container.remove();
    if (activeCelebration === container) activeCelebration = null;
  }, durationMs);
}

const FIRED_KEY_PREFIX = "pp.celebrated.";

/** Fire once per browser per `key` — for milestone moments. */
export function celebrateOnce(key: string, opts?: CelebrateOptions): void {
  if (typeof window === "undefined") return;
  const fullKey = FIRED_KEY_PREFIX + key;
  if (window.localStorage.getItem(fullKey)) return;
  window.localStorage.setItem(fullKey, String(Date.now()));
  celebrate(opts);
}
