/** Deterministic floating light particles (server-rendered, CSS-animated). */
export function Particles({ count = 22 }: { count?: number }) {
  const items = Array.from({ length: count }, (_, i) => {
    const r = (k: number) => ((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;
    return { left: `${r(1) * 100}%`, bottom: `${r(2) * -10}%`, size: 2 + r(3) * 4, duration: 10 + r(4) * 14, delay: -r(5) * 20, opacity: 0.35 + r(6) * 0.6 };
  });
  return <>{items.map((p, i) => <span key={i} className="lp-particle" aria-hidden style={{ left: p.left, bottom: p.bottom, width: p.size, height: p.size, animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s`, opacity: p.opacity }} />)}</>;
}
