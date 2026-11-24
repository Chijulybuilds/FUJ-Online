import { OUTLINE, pt } from "@/components/landing/nigeria-map";
import { MISSION_LOCATIONS, missionStats, type MissionLocation } from "@/lib/missions";

const xyOf = (l: MissionLocation) => (l.xy ?? pt(l.lonlat!)) as readonly [number, number];

/**
 * The same calm map as the landing page — Nigeria's outline, glowing dots and dotted lines from Port Harcourt —
 * with a soft green-white-green flag tint, and every dot clickable: it opens that location's Love Missions.
 */
export function FlagMap() {
  const d = OUTLINE.map((c, i) => `${i ? "L" : "M"}${pt(c).join(" ")}`).join(" ") + " Z";
  const hq = MISSION_LOCATIONS.find((l) => l.hq)!;
  const [hx, hy] = xyOf(hq);
  return (
    <svg viewBox="0 -70 390 390" className="ng-map flag-map" role="group" aria-label="Map of Nigeria. Choose a location to see its Love Missions.">
      <defs><clipPath id="ng-clip"><path d={d} /></clipPath></defs>
      {/* A soft Nigerian-flag tint inside the outline: green · white · green. */}
      <g clipPath="url(#ng-clip)" opacity=".9">
        <rect x="0" y="0" width="131" height="320" fill="rgba(0,135,81,.38)" />
        <rect x="131" y="0" width="119" height="320" fill="rgba(255,255,255,.10)" />
        <rect x="250" y="0" width="140" height="320" fill="rgba(0,135,81,.38)" />
      </g>
      <path d={d} fill="none" stroke="rgba(120,220,170,.6)" strokeWidth="1.5" strokeLinejoin="round" />
      {MISSION_LOCATIONS.filter((l) => !l.hq).map((l) => {
        const [x, y] = xyOf(l);
        const abroad = !l.lonlat;
        const curve = abroad ? `M${hx} ${hy} C ${hx + 160} ${hy - 160}, ${x + 120} ${y - 10}, ${x} ${y}` : `M${hx} ${hy} Q ${(hx + x) / 2 - 30} ${(hy + y) / 2 - 40} ${x} ${y}`;
        return <path key={`arc-${l.slug}`} d={curve} className={`ng-arc flag-arc ${abroad ? "abroad" : ""}`} />;
      })}
      {MISSION_LOCATIONS.map((l) => {
        const [x, y] = xyOf(l);
        const n = missionStats(l).outreaches;
        return (
          <a key={l.slug} href={`/love-missions/${l.slug}`} className="flag-pin" data-testid={`map-pin-${l.slug}`} aria-label={`${l.name} — ${l.tagline}${n ? `, ${n} outreach${n === 1 ? "" : "es"}` : ""}`}>
            <circle cx={x} cy={y} r="18" className="flag-pin-hit" />
            {l.hq && <circle cx={x} cy={y} r="16" className="flag-pin-pulse" />}
            <circle cx={x} cy={y} r={l.hq ? 6 : 4.5} className="flag-pin-dot" />
            <text x={x + l.labelDx} y={y + l.labelDy} className="ng-label flag-pin-label">{l.name}{l.lonlat ? "" : " ↗"}</text>
          </a>
        );
      })}
    </svg>
  );
}
