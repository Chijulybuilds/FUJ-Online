/** Simplified outline of Nigeria with pulsing markers for where FlagUpJesus serves, plus the UK beyond the map. */
const OUTLINE: [number, number][] = [[2.7,6.4],[2.7,9.1],[3.6,11.7],[3.6,12.5],[4.2,13.5],[5.3,13.8],[6.4,13.6],[7.8,13.3],[9,12.8],[10.6,13.3],[12.3,13.1],[13.6,13.7],[14.2,12.4],[14.6,11.6],[13.6,10.2],[13.3,9],[12.4,8.4],[11.8,7],[11,6.4],[9.8,5.8],[8.6,4.7],[7.1,4.4],[6,4.3],[5.2,5.3],[4.4,6.3]];
const pt = ([lon, lat]: [number, number]) => [(lon - 2.3) * 30, (14.2 - lat) * 31] as const;

type Place = { name: string; note: string; lonlat?: [number, number]; xy?: [number, number]; hq?: boolean; abroad?: boolean; dx: number; dy: number };

export const PLACES: Place[] = [
  { name: "Port Harcourt", note: "Headquarters", lonlat: [7.0, 4.82], hq: true, dx: 12, dy: 18 },
  { name: "Lagos", note: "Miracle Service & Love Campaigns", lonlat: [3.4, 6.52], dx: 12, dy: -10 },
  { name: "Abuja", note: "Youth outreach groups", lonlat: [7.49, 9.06], dx: 12, dy: 4 },
  { name: "Bayelsa", note: "Medical outreach", lonlat: [6.26, 4.93], dx: -86, dy: 22 },
  // Far north of the map: drawn above Nigeria with a long arc from Port Harcourt.
  { name: "United Kingdom", note: "International", xy: [34, -44], abroad: true, dx: 14, dy: 4 }
];

const xyOf = (p: Place) => (p.xy ?? pt(p.lonlat!)) as readonly [number, number];

export function NigeriaMap() {
  const d = OUTLINE.map((c, i) => `${i ? "L" : "M"}${pt(c).join(" ")}`).join(" ") + " Z";
  const [hx, hy] = xyOf(PLACES[0]);
  return (
    <svg viewBox="0 -70 390 390" className="ng-map" role="img" aria-label="Map showing where FlagUpJesus serves: Port Harcourt (headquarters), Lagos, Abuja and Bayelsa in Nigeria, and the United Kingdom">
      <defs>
        <linearGradient id="ngfill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="rgba(255,255,255,.10)" /><stop offset="1" stopColor="rgba(255,255,255,.03)" /></linearGradient>
      </defs>
      <path d={d} fill="url(#ngfill)" stroke="rgba(255,199,203,.55)" strokeWidth="1.5" strokeLinejoin="round" className="ng-outline" />
      {PLACES.filter((p) => !p.hq).map((p) => {
        const [x, y] = xyOf(p);
        const curve = p.abroad ? `M${hx} ${hy} C ${hx + 160} ${hy - 160}, ${x + 120} ${y - 10}, ${x} ${y}` : `M${hx} ${hy} Q ${(hx + x) / 2 - 30} ${(hy + y) / 2 - 40} ${x} ${y}`;
        return <path key={`arc-${p.name}`} d={curve} className={`ng-arc ${p.abroad ? "abroad" : ""}`} />;
      })}
      {PLACES.map((p, i) => {
        const [x, y] = xyOf(p);
        return (
          <g key={p.name} className="ng-pin" data-place={p.name}>
            <circle cx={x} cy={y} r={p.hq ? 16 : 11} className="ng-pulse" style={{ animationDelay: `${i * 0.6}s` }} />
            <circle cx={x} cy={y} r={p.hq ? 6 : 4.5} fill={p.hq || p.abroad ? "#ffc7cb" : "#ff6b74"} />
            <text x={x + p.dx} y={y + p.dy} className="ng-label">{p.name}{p.abroad ? " ↗" : ""}</text>
          </g>
        );
      })}
    </svg>
  );
}
