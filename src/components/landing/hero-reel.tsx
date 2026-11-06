import Image from "next/image";
import { PHOTOS, type Photo } from "./photos";

type Card = { photo: Photo; kicker: string; caption: string };

const TOP: Card[] = [
  { photo: PHOTOS.children, kicker: "Love Mission · Bayelsa", caption: "Joy restored" },
  { photo: PHOTOS.medical, kicker: "Free pharmacy", caption: "Medicine at no cost" },
  { photo: PHOTOS.teaching, kicker: "Health education", caption: "Teaching families to stay well" },
  { photo: PHOTOS.elders, kicker: "Care for the elderly", caption: "No one is forgotten" }
];
const BOTTOM: Card[] = [TOP[2], TOP[3], TOP[0], TOP[1]];

function Row({ cards, className }: { cards: Card[]; className: string }) {
  // Four copies → the track loops seamlessly after travelling half its width (two copies).
  const loop = [...cards, ...cards, ...cards, ...cards];
  return (
    <div className={`reel-row ${className}`}>
      {loop.map((c, i) => (
        <figure key={i} className="reel-card" style={{ aspectRatio: String(Math.min(1.35, Math.max(0.78, c.photo.w / c.photo.h))) }}>
          <Image src={c.photo.src} alt={i < cards.length ? c.photo.alt : ""} fill sizes="420px" className="object-cover" priority={i < 2} />
          <figcaption><span>{c.kicker}</span><b>{c.caption}</b></figcaption>
        </figure>
      ))}
    </div>
  );
}

/** Outreach photos gliding from the right edge toward the centre of the hero, fading as they arrive. */
export function HeroReel() {
  return (
    <div className="hero-reel" aria-label="Photos from FlagUpJesus Love Missions">
      <div className="reel-stage">
        <Row cards={TOP} className="r1" />
        <Row cards={BOTTOM} className="r2" />
      </div>
      <div className="reel-badge"><span className="live-dot" /> Global Love Campaigns · Free medical care, food &amp; the gospel</div>
    </div>
  );
}
