import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, Camera, HeartHandshake, MapPin } from "lucide-react";
import { LandingNav } from "@/components/landing/nav";
import { Gallery } from "@/components/missions/gallery";
import { MISSION_LOCATIONS, missionLocation, missionStats } from "@/lib/missions";

const slugify = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export function generateStaticParams() {
  return MISSION_LOCATIONS.map((l) => ({ location: l.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ location: string }> }): Promise<Metadata> {
  const l = missionLocation((await params).location);
  return l ? { title: `${l.name} — Love Missions | FlagUpJesus Global Ministry`, description: l.summary } : {};
}

export default async function MissionLocationPage({ params }: { params: Promise<{ location: string }> }) {
  const l = missionLocation((await params).location);
  if (!l) notFound();
  const s = missionStats(l);
  const others = MISSION_LOCATIONS.filter((o) => o.slug !== l.slug);
  return (
    <main className="missions-page">
      <LandingNav />
      <section className="mission-hero">
        <div className="mx-auto max-w-7xl px-5 pb-12 pt-32">
          <Link href="/love-missions" className="inline-flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white"><ArrowLeft size={16} /> All Love Missions</Link>
          <p className="mt-6 text-xs font-extrabold uppercase tracking-[.16em] text-white/75"><MapPin size={13} className="mr-1 inline" />{l.region}{l.country !== "Nigeria" ? "" : " · Nigeria"}</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-white sm:text-6xl">{l.name}</h1>
          <p className="mt-2 text-xl font-semibold text-white/90">{l.tagline}</p>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-white/80">{l.summary}</p>
          {s.outreaches > 0 && (
            <dl className="mt-8 flex flex-wrap gap-3 text-white">
              <div className="mission-stat"><dt>Outreaches</dt><dd>{s.outreaches}</dd></div>
              <div className="mission-stat"><dt>Communities</dt><dd>{s.areas}</dd></div>
              <div className="mission-stat"><dt>Photos</dt><dd>{s.photos}</dd></div>
            </dl>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14">
        {l.areas.length > 1 && (
          <nav className="mb-10 flex flex-wrap gap-2" aria-label={`Communities in ${l.name}`}>
            {l.areas.map((a) => <a key={a.name} href={`#${slugify(a.name)}`} className="btn btn-secondary btn-sm">{a.name}{a.outreaches[0]?.year ? ` · ${a.outreaches[0].year}` : ""}</a>)}
          </nav>
        )}
        {l.areas.map((area) => (
          <div key={area.name} id={slugify(area.name)} className="mb-14 scroll-mt-24" data-testid="mission-area">
            <h2 className="flex items-center gap-2 text-2xl font-extrabold"><span className="h-6 w-1.5 rounded-full bg-[#008751]" />{area.name}</h2>
            {area.outreaches.map((o) => (
              <article key={o.title + (o.year ?? "")} className="mt-6">
                {(area.outreaches.length > 1 || o.title !== area.name)
                  ? <h3 className="text-lg font-bold">{o.title}{o.year ? ` · ${o.year}` : ""}</h3>
                  : o.year && <p className="text-sm font-bold">{o.year}</p>}
                {o.summary && <p className="mt-1 max-w-3xl muted">{o.summary}</p>}
                <div className="mt-4"><Gallery photos={o.photos} title={`${o.title} — ${l.name}`} /></div>
              </article>
            ))}
          </div>
        ))}
        {!l.areas.length && (
          <div className="rounded-3xl border p-10 text-center" style={{ borderColor: "var(--border)" }} data-testid="mission-coming-soon">
            <Camera className="mx-auto text-[#008751]" size={30} />
            <p className="mt-3 text-xl font-bold">Photos from {l.name} are coming soon</p>
            <p className="mt-2 muted">We&apos;re gathering the pictures and stories from our Love Missions here.</p>
          </div>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-[#008751] p-6 text-white">
          <p className="flex items-center gap-2 text-lg font-semibold"><HeartHandshake size={20} /> Help us reach more communities{l.country === "Nigeria" ? ` in ${l.region}` : ""}.</p>
          <div className="flex flex-wrap gap-3"><Link href="/register" className="btn lp-btn-light">Volunteer <ArrowRight size={16} /></Link><Link href="/#give" className="btn lp-btn-glass">Sponsor an outreach</Link></div>
        </div>
        <p className="mt-12 text-sm font-bold uppercase tracking-wider muted">More Love Missions</p>
        <div className="mt-3 flex flex-wrap gap-2">{others.map((o) => <Link key={o.slug} href={`/love-missions/${o.slug}`} className="btn btn-secondary btn-sm"><MapPin size={14} /> {o.name}</Link>)}</div>
      </section>
    </main>
  );
}
