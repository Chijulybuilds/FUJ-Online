import Image from "next/image";

type Photo = { src: string; w: number; h: number; alt: string };
type Card = { photo: Photo; kicker: string; caption: string };
const pic = (file: string, w: number, h: number, alt: string): Photo => ({ src: `/images/missions/${file}.webp`, w, h, alt });

// Ten different photos from the Love Missions albums — no photo appears in both rows.
const TOP: Card[] = [
  { photo: pic("bayelsa/sagbama-2026-10", 1080, 788, "Children cheering at the Sagbama outreach in Bayelsa State"), kicker: "Love Mission · Sagbama", caption: "Joy restored" },
  { photo: pic("port-harcourt/nkpolu-2024-02", 854, 854, "Volunteer nurses giving free health checks at the Nkpolu outreach"), kicker: "Free medical care", caption: "Health checks at no cost" },
  { photo: pic("bayelsa/sagbama-2026-02", 1280, 853, "Volunteers handing out relief packs to families in Sagbama"), kicker: "Food & relief", caption: "Relief for every family" },
  { photo: pic("port-harcourt/nkpolu-2024-01", 720, 720, "A volunteer giving an elderly man a free haircut at the Nkpolu outreach"), kicker: "Care for the elderly", caption: "No one is forgotten" },
  { photo: pic("united-kingdom/portsmouth-01", 1024, 924, "The FlagUpJesus UK team sharing the gospel in Portsmouth"), kicker: "Love Mission · United Kingdom", caption: "The gospel on the streets" }
];
const BOTTOM: Card[] = [
  { photo: pic("port-harcourt/akpajo-2023-03", 1080, 720, "Sharing the gospel with a crowd at the Akpajo outreach"), kicker: "The gospel, in person", caption: "Good news for everyone" },
  { photo: pic("port-harcourt/bundu-2024-02", 1280, 854, "A volunteer checking a woman's blood pressure at the Bundu outreach"), kicker: "Free medical care", caption: "Checked, treated, prayed for" },
  { photo: pic("port-harcourt/okporo-2020-90", 1280, 854, "A community celebrating together at a FlagUpJesus outreach"), kicker: "Love Mission · Port Harcourt", caption: "A community rejoicing" },
  { photo: pic("port-harcourt/elekahia-2022-04", 960, 640, "Shoes and clothing laid out for families at the Elekahia outreach"), kicker: "Clothing & shoes", caption: "Dignity restored" },
  { photo: pic("port-harcourt/okporo-2020-26", 683, 456, "Volunteers and families gathered at the Okporo school outreach"), kicker: "Love Mission · Okporo", caption: "Serving together" }
];

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
