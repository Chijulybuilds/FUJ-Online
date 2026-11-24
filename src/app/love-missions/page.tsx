import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, MapPin } from "lucide-react";
import { LandingNav } from "@/components/landing/nav";
import { FlagMap } from "@/components/missions/flag-map";
import { MISSION_LOCATIONS, missionStats } from "@/lib/missions";

export const metadata: Metadata = { title: "Love Missions | FlagUpJesus Global Ministry", description: "Where the FlagUp Jesus Army has taken free medical care, food and the gospel — Port Harcourt, Bayelsa, Lagos and the United Kingdom." };

export default function LoveMissionsPage() {
  return (
    <main className="missions-page">
      <LandingNav />
      <section className="mission-hero">
        <div className="mx-auto max-w-7xl px-5 pb-12 pt-32 text-white">
          <p className="text-xs font-extrabold uppercase tracking-[.16em] text-white/75">Global Love Campaigns</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">Love Missions — tap a place to see what God has done there.</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-white/80">The FlagUp Jesus Army goes into communities with free medical care, food, clothing and the gospel. Choose a location on the map to see every outreach and photo from there.</p>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 pb-16 pt-10">
        <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_.85fr]">
          <div className="flag-map-wrap"><FlagMap /></div>
          <ul className="grid gap-3" data-testid="mission-locations">
            {MISSION_LOCATIONS.map((l) => {
              const s = missionStats(l);
              return (
                <li key={l.slug}>
                  <Link href={`/love-missions/${l.slug}`} className="mission-card">
                    <span className="mission-card-img">{s.cover ? <Image src={s.cover.src} alt="" fill sizes="96px" className="object-cover" /> : <MapPin size={22} />}</span>
                    <span className="min-w-0 flex-1">
                      <b className="block">{l.name}{l.hq && <span className="ml-2 align-middle text-[10px] font-bold uppercase tracking-wider text-[#008751]">HQ</span>}</b>
                      <span className="block text-sm muted">{l.region} · {l.tagline}</span>
                      <span className="mt-1 block text-xs muted">{s.outreaches ? `${s.outreaches} outreach${s.outreaches === 1 ? "" : "es"} · ${s.photos} photo${s.photos === 1 ? "" : "s"}` : "Photos coming soon"}</span>
                    </span>
                    <ArrowRight size={18} className="shrink-0 text-[#008751]" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 rounded-3xl border p-6" style={{ borderColor: "var(--border)" }}>
          <p className="text-lg font-semibold">Want to serve on the next Love Mission — or sponsor one?</p>
          <div className="flex flex-wrap gap-3"><Link href="/register" className="btn btn-primary">Volunteer with us <ArrowRight size={16} /></Link><Link href="/#give" className="btn btn-secondary">Sponsor an outreach</Link></div>
        </div>
      </section>
    </main>
  );
}
