import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight, BookOpen, Flame, Globe2, HandHeart, Heart, Mail, MapPin, Mic2, Music, Phone, PlayCircle,
  Scissors, ScanLine, ShoppingBasket, Sparkles, Stethoscope
} from "lucide-react";
import { LandingNav } from "@/components/landing/nav";
import { LayerRail } from "@/components/landing/layer-rail";
import { Countdown } from "@/components/landing/countdown";
import { Particles } from "@/components/landing/particles";
import { Slideshow } from "@/components/landing/slideshow";
import { PhotoMarquee } from "@/components/landing/photo-marquee";
import { ScrollWords } from "@/components/landing/scroll-words";
import { NigeriaMap, PLACES } from "@/components/landing/nigeria-map";
import { Books } from "@/components/landing/books";
import { PHOTOS } from "@/components/landing/photos";
import { Reveal } from "@/components/shared/reveal";
import { CopyButton } from "@/components/shared/copy-button";
import { PrayerForm } from "@/components/shared/prayer-form";
import { BrandLogo } from "@/components/shared/brand-logo";
import { getSettings, parseServiceTimes } from "@/lib/repo/settings";
import { upcomingService } from "@/lib/repo/services";
import { publishedAnnouncements, publishedTestimonies, prayerWall } from "@/lib/repo/content";
import { formatDate, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const LAYERS = [
  { id: "founder", label: "The Founder" },
  { id: "mission", label: "Our Heartbeat" },
  { id: "outreach", label: "Love Missions" },
  { id: "gatherings", label: "Word & Worship" },
  { id: "reach", label: "Our Reach" }
];

const LINKS = {
  site: "https://umanuwacaleb.com/",
  about: "https://umanuwacaleb.com/about.html",
  instagram: "https://www.instagram.com/flagupjesusglobalministry/",
  facebook: "https://www.facebook.com/61577029430006/"
};

function Words({ text, delay = 0 }: { text: string; delay?: number }) {
  return <>{text.split(" ").map((w, i) => <span className="lp-word" key={i}><span style={{ animationDelay: `${delay + i * 0.08}s` }}>{w}&nbsp;</span></span>)}</>;
}

function LayerTag({ n, children }: { n: number; children: React.ReactNode }) {
  return <p className="layer-tag"><b>{String(n).padStart(2, "0")}</b><span className="h-px w-8 bg-current opacity-50" />{children}</p>;
}

async function loadLanding() {
  try {
    const [settings, next, news, testimonies, wall] = await Promise.all([
      getSettings(), upcomingService(), publishedAnnouncements({ publicOnly: true }), publishedTestimonies(true), prayerWall()
    ]);
    return { settings, next, news, testimonies, wall };
  } catch (error) {
    console.error("landing data unavailable", error);
    return null;
  }
}

export default async function HomePage() {
  const data = await loadLanding();
  const settings = data?.settings;
  const times = parseServiceTimes(settings?.service_times ?? "Sunday Service|Sundays · 9:00 AM\nBible Study|Wednesdays · 5:30 PM");
  const live = data?.next?.status === "active";
  const watchUrl = settings?.livestream_url || "#gatherings";
  const external = settings?.livestream_url ? { target: "_blank", rel: "noreferrer" } : {};
  const marquee = ["Gospel", "Love", "Revival", "Healing", "Discipleship", "Compassion", "Mission", "Grace"];
  const outreachPhotos = [PHOTOS.children, PHOTOS.medical, PHOTOS.teaching, PHOTOS.elders];

  return (
    <main className="lp">
      <LandingNav />
      <LayerRail layers={LAYERS} />

      {/* ============ LAYER 01 — THE FOUNDER ============ */}
      <section id="founder" className="lp-hero layer">
        <div className="lp-aurora" aria-hidden><span /><span /><span /></div>
        <div className="lp-rays" aria-hidden />
        <div className="lp-grain" aria-hidden />
        <Particles />
        <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-5 pb-20 pt-28 lg:grid-cols-[1.15fr_.85fr] lg:gap-14 lg:pt-32">
          <div>
            <span className="lp-eyebrow lp-fade"><span className={live ? "live-dot" : "hero-eyebrow-dot"} /> {live ? "LIVE NOW" : "FLAGUPJESUS GLOBAL MINISTRY · PORT HARCOURT"}</span>
            <h1 className="lp-title mt-7">
              <Words text="Raise the flag." delay={0.1} /><br />
              <span className="lp-word"><span style={{ animationDelay: ".45s" }}><em>Lift up Jesus.</em></span></span>
            </h1>
            <p className="lp-fade mt-7 max-w-xl text-lg leading-8 text-white/75" style={{ animationDelay: ".7s" }}>
              A non-denominational Christian ministry pairing uncompromising, apostolic teaching with feet-on-the-ground love —
              raising <b className="text-white">gospel giants</b> and carrying hope, medicine and food to the communities that need it most.
            </p>
            <div className="lp-fade mt-9 flex flex-wrap gap-3" style={{ animationDelay: ".85s" }}>
              <a className="btn lp-btn-light px-6 py-3" href={watchUrl} {...external}><PlayCircle size={18} /> {live ? "Join the live service" : "Worship with us"}</a>
              <a className="btn lp-btn-glass px-6 py-3" href="#outreach">See the Love Missions <ArrowRight size={17} /></a>
            </div>
            {data?.next && (
              <div className="lp-fade mt-12" style={{ animationDelay: "1s" }}>
                <p className="mb-3 text-xs font-bold tracking-[.18em] text-white/55">{live ? data.next.title.toUpperCase() : `NEXT: ${data.next.title.toUpperCase()} · ${formatDateTime(data.next.starts_at).toUpperCase()}`}</p>
                <Countdown target={data.next.starts_at} live={live} />
              </div>
            )}
          </div>
          <div className="lp-fade order-first lg:order-none" style={{ animationDelay: ".4s" }}>
            <div className="founder">
              <span className="ring" aria-hidden /><span className="ring r2" aria-hidden />
              <div className="frame">
                <Image src={PHOTOS.pastor.src} alt={PHOTOS.pastor.alt} fill priority sizes="(max-width: 1024px) 90vw, 440px" className="object-cover object-top" />
              </div>
              <div className="name text-white">
                <p className="text-xs font-bold tracking-[.2em] text-[#ffd9a0]">FOUNDER &amp; LEAD PASTOR</p>
                <p className="mt-1 text-2xl font-extrabold">Pastor Umanuwa D. Caleb</p>
              </div>
              <div className="badge lp-float -left-6 top-14 hidden sm:block" style={{ animationDelay: "-2s" }}><BookOpen size={16} className="mb-1 text-[#ffd9a0]" />Author · Philanthropist<br />Songwriter</div>
              <div className="badge lp-float -right-5 top-1/2 hidden sm:block" style={{ animationDelay: "-4s" }}><HandHeart size={16} className="mb-1 text-[#ff9aa1]" />Word <b>+</b> Works</div>
            </div>
          </div>
        </div>
        <a href="#mission" className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 lg:block" aria-label="Scroll to the next layer"><span className="lp-scroll-cue block" /></a>
      </section>

      <div className="lp-marquee" aria-hidden>
        <div className="lp-marquee-track">{[...marquee, ...marquee].map((w, i) => <span key={i}>{w} <span className="mx-4 text-[var(--accent)]">✦</span></span>)}</div>
      </div>

      {/* ============ LAYER 02 — OUR HEARTBEAT ============ */}
      <section id="mission" className="layer lp-section">
        <div className="mx-auto w-full max-w-7xl px-5">
          <Reveal><LayerTag n={2}>Our heartbeat</LayerTag></Reveal>
          <ScrollWords className="motto mt-8 max-w-5xl" text="“Good news that ignores an empty stomach is only half the message.”" />
          <Reveal><p className="mt-6 text-sm font-semibold muted">— The FlagUpJesus motto</p></Reveal>
          <div className="mt-16 grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
            <Reveal>
              <article className="engine">
                <span className="lp-icon"><Flame size={22} /></span>
                <h2 className="mt-6 text-3xl font-extrabold">The Word</h2>
                <p className="mt-3 leading-7 muted">Strict biblical, apostolic teaching. Through fellowship, discipleship and revival we raise believers who know God deeply and carry His fire into every sphere of life.</p>
                <span className="big" aria-hidden>Word</span>
              </article>
            </Reveal>
            <Reveal delay={0.1} className="flex justify-center"><span className="engine-plus" aria-hidden>+</span></Reveal>
            <Reveal delay={0.2}>
              <article className="engine">
                <span className="lp-icon"><HandHeart size={22} /></span>
                <h2 className="mt-6 text-3xl font-extrabold">The Works</h2>
                <p className="mt-3 leading-7 muted">Aggressive, feet-on-the-ground humanitarian aid. Free medical care, food, clothing and dignity — the love of Christ made practical in the places others overlook.</p>
                <span className="big" aria-hidden>Works</span>
              </article>
            </Reveal>
          </div>
          <Reveal className="mt-10 flex flex-wrap gap-2" delay={0.1}>
            {["Non-denominational", "Faith-based", "Holistic ministry", "Headquartered in Port Harcourt"].map((t) => <span key={t} className="tab">{t}</span>)}
          </Reveal>
        </div>
      </section>

      {/* ============ LAYER 03 — GLOBAL LOVE CAMPAIGNS ============ */}
      <section id="outreach" className="layer lp-dark relative overflow-hidden py-24">
        <div className="lp-aurora opacity-40" aria-hidden><span /><span /><span /></div>
        <div className="relative w-full">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 lg:grid-cols-[.9fr_1.1fr]">
            <div>
              <Reveal><LayerTag n={3}>Global Love Campaigns</LayerTag></Reveal>
              <Reveal delay={0.05}><h2 className="lp-h2 mt-5">We don&apos;t wait for people to find the altar. <em className="!text-[#ffd9a0]">We take it to them.</em></h2></Reveal>
              <Reveal delay={0.1}><p className="mt-6 max-w-xl text-lg leading-8 muted">Through our International Love Missions — the <b className="text-white">FlagUp Jesus Army</b> — volunteers systematically enter economically disadvantaged suburbs and villages with the gospel and real relief.</p></Reveal>
              <div className="mt-8 grid gap-3">
                {[
                  { I: Stethoscope, t: "Free medical care", d: "Mobile clinics with volunteer doctors, nurses, pharmacists and medical scientists — free consultations and prescription drugs." },
                  { I: ShoppingBasket, t: "Food & relief", d: "Staple food packages, clothing and footwear delivered directly to struggling families." },
                  { I: Scissors, t: "Community care", d: "Free barbing and hair braiding — restoring personal dignity alongside the gospel." },
                  { I: Heart, t: "The gospel, in person", d: "Every outreach carries the good news of Jesus to people who may never walk into a church." }
                ].map(({ I, t, d }, k) => (
                  <Reveal key={t} delay={0.1 + k * 0.08}><div className="care-chip"><span className="ic"><I size={20} /></span><div><p className="font-bold">{t}</p><p className="mt-1 text-sm muted">{d}</p></div></div></Reveal>
                ))}
              </div>
            </div>
            <Reveal delay={0.15}>
              <Slideshow slides={[
                { photo: PHOTOS.children, kicker: "Bayelsa State Medical Outreach", caption: "Joy restored — Pastor Caleb with the children" },
                { photo: PHOTOS.medical, kicker: "Free pharmacy", caption: "Volunteer pharmacists dispensing free medication" },
                { photo: PHOTOS.teaching, kicker: "Health education", caption: "Teaching families how to stay well" },
                { photo: PHOTOS.elders, kicker: "Care for the elderly", caption: "No one is too far, too old or too poor to be loved" }
              ]} />
            </Reveal>
          </div>
          <div className="mt-16 space-y-4">
            <PhotoMarquee photos={outreachPhotos} height={200} />
            <PhotoMarquee photos={[...outreachPhotos].reverse()} reverse height={160} />
          </div>
          <Reveal className="mx-auto mt-12 flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5">
            <p className="text-lg font-semibold">Want to serve on the next Love Mission — or sponsor one?</p>
            <div className="flex flex-wrap gap-3"><Link href="/register" className="btn lp-btn-light">Volunteer with us <ArrowRight size={16} /></Link><a href="#give" className="btn lp-btn-glass">Sponsor an outreach</a></div>
          </Reveal>
        </div>
      </section>

      {/* ============ LAYER 04 — WORD & WORSHIP ============ */}
      <section id="gatherings" className="layer lp-section">
        <div className="mx-auto w-full max-w-7xl px-5">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <Reveal><LayerTag n={4}>Word &amp; Worship</LayerTag></Reveal>
              <Reveal delay={0.05}><h2 className="lp-h2 mt-5 max-w-2xl">Raising <em>gospel giants.</em></h2></Reveal>
              <Reveal delay={0.1}><p className="mt-5 max-w-xl text-lg muted">Fellowship, discipleship and revival designed around spiritual growth, a renewed mind and discovering your divine purpose.</p></Reveal>
            </div>
            <Reveal delay={0.1}><a href={watchUrl} {...external} className="btn btn-primary px-5 py-3"><PlayCircle size={17} /> {live ? "Watch live now" : "Watch online"}</a></Reveal>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {[
              { I: BookOpen, t: "Word Experience", d: "Our weekly gathering — the Word taught with depth, clarity and power.", tag: "Weekly" },
              { I: Sparkles, t: "Bible Study", d: "Deep-dive sessions for spiritual growth, mental refinement and purpose.", tag: "Midweek" },
              { I: Globe2, t: "International Prayer & Mission Conference", d: "Equipping believers with supernatural empowerment for kingdom advancement.", tag: "Conference" },
              { I: Music, t: "Unveiled Worship Encounter", d: "Non-judgmental, spirit-led praise and deep worship.", tag: "Encounter" }
            ].map(({ I, t, d, tag }, k) => (
              <Reveal key={t} delay={k * 0.08}>
                <article className="gathering h-full">
                  <div className="relative flex items-start justify-between"><span className="lp-icon"><I size={22} /></span><span className="pill pill-blue">{tag}</span></div>
                  <div className="relative mt-8"><h3 className="text-xl font-bold leading-tight">{t}</h3><p className="mt-2 text-sm leading-6 muted">{d}</p></div>
                </article>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-8" delay={0.1}>
            <div className="lp-card grid gap-6 p-7 md:grid-cols-[auto_1fr] md:items-center">
              <div className="flex items-center gap-3"><span className="lp-icon"><Mic2 size={22} /></span><p className="text-lg font-bold">Service times</p></div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {times.map((t) => <div key={t.name + t.when}><p className="font-semibold">{t.name}</p><p className="text-sm muted">{t.when}</p></div>)}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ LAYER 05 — OUR REACH & LEADERSHIP ============ */}
      <section id="reach" className="layer lp-dark relative overflow-hidden py-24">
        <div className="mx-auto grid w-full max-w-7xl gap-16 px-5">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Reveal><LayerTag n={5}>From Port Harcourt to the nations</LayerTag></Reveal>
              <Reveal delay={0.05}><h2 className="lp-h2 mt-5">Rooted in Rivers State. <em className="!text-[#ffd9a0]">Growing everywhere.</em></h2></Reveal>
              <Reveal delay={0.1}><p className="mt-6 max-w-lg text-lg leading-8 muted">Firmly rooted in Port Harcourt, FlagUpJesus is scaling fast — with Lagos Miracle Services and Love Campaigns, youth teams in Abuja winning souls on the streets, and medical missions reaching communities across the Niger Delta.</p></Reveal>
              <div className="mt-8">
                {PLACES.map((p, k) => (
                  <Reveal key={p.name} delay={0.1 + k * 0.07}><div className="place-row"><span className={`dot ${p.hq ? "hq" : ""}`} /><p className="font-bold">{p.name}</p><p className="ml-auto text-sm muted">{p.note}</p></div></Reveal>
                ))}
              </div>
            </div>
            <Reveal delay={0.15}><div className="mx-auto w-full max-w-lg"><NigeriaMap /></div></Reveal>
          </div>

          <div className="grid items-center gap-12 rounded-[32px] border border-white/10 bg-white/[.03] p-8 sm:p-12 lg:grid-cols-[auto_1fr]">
            <Reveal>
              <div className="relative mx-auto h-56 w-48 overflow-hidden rounded-[120px_120px_24px_24px] shadow-2xl">
                <Image src={PHOTOS.pastor.src} alt={PHOTOS.pastor.alt} fill sizes="200px" className="object-cover object-top" />
              </div>
            </Reveal>
            <div>
              <Reveal><p className="lp-kicker !text-[#ff9aa1]">Leadership &amp; teaching</p></Reveal>
              <Reveal delay={0.05}><h3 className="mt-3 text-3xl font-extrabold">Pastor Umanuwa D. Caleb</h3></Reveal>
              <Reveal delay={0.1}><p className="mt-3 max-w-2xl leading-7 muted">Founder and lead pastor of FlagUpJesus Global Ministry — an author, philanthropist and songwriter whose published work directly underpins what we teach.</p></Reveal>
              <Reveal delay={0.15} className="mt-8"><Books /></Reveal>
              <Reveal delay={0.2} className="mt-8 flex flex-wrap gap-3"><a href={LINKS.about} target="_blank" rel="noreferrer" className="btn lp-btn-light">About Pastor Caleb <ArrowRight size={16} /></a><a href={LINKS.site} target="_blank" rel="noreferrer" className="btn lp-btn-glass">umanuwacaleb.com</a></Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- CHECK-IN ---------------- */}
      <section id="checkin" className="lp-section">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <Reveal><p className="lp-kicker">Sunday check-in</p><h2 className="lp-h2 mt-4">Scan. Type your username. <em>You&apos;re in.</em></h2><p className="mt-5 max-w-xl text-lg muted">Register once, receive your personal <b>flag</b> username, and use it at every service — no SMS codes every Sunday.</p></Reveal>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[{ I: ScanLine, t: "Scan the live QR", d: "It refreshes every 20 seconds on the screen." }, { I: Sparkles, t: "Type your username", d: "e.g. flaggrace101 — you get it at registration." }, { I: Heart, t: "Counted & cared for", d: "Miss a few Sundays? Our pastors will check on you." }].map(({ I, t, d }, i) => (
                <Reveal key={t} delay={i * 0.1}><div className="lp-card relative h-full overflow-hidden p-6"><span className="lp-step-num absolute right-4 top-2 !text-[3.2rem]">{i + 1}</span><span className="lp-icon"><I size={20} /></span><h3 className="mt-5 font-bold">{t}</h3><p className="mt-1 text-sm muted">{d}</p></div></Reveal>
              ))}
            </div>
            <Reveal className="mt-8 flex flex-wrap gap-3" delay={0.2}><Link href="/register" className="btn btn-primary px-5 py-3">Get my username</Link><Link href="/login" className="btn btn-secondary px-5 py-3">Member sign in</Link></Reveal>
          </div>
          <Reveal delay={0.15}>
            <div className="lp-float mx-auto w-fit">
              <div className="lp-phone">
                <div className="bg-[#120d0e] px-5 pb-6 pt-8 text-white"><p className="text-[10px] tracking-[.2em] text-red-200">SUNDAY CHECK-IN</p><p className="mt-2 text-lg font-bold">Welcome back! 👋</p></div>
                <div className="space-y-3 p-5">
                  <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>Your username</p>
                  <div className="input username-badge text-sm">flaggrace101<span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-current align-middle" /></div>
                  <div className="btn btn-primary w-full">Check in</div>
                  <div className="alert alert-ok text-center text-xs">✓ You&apos;re checked in, Grace!</div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- NEWS ---------------- */}
      {data && data.news.length > 0 && (
        <section id="news" className="lp-section pt-0">
          <div className="mx-auto max-w-7xl px-5">
            <Reveal><p className="lp-kicker">What&apos;s happening</p><h2 className="lp-h2 mt-4">Ministry <em>news</em></h2></Reveal>
            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {data.news.slice(0, 3).map((a, i) => (
                <Reveal key={a.id} delay={i * 0.1}><article className="lp-card h-full p-7"><p className="text-xs font-semibold text-[var(--accent)]">{a.pinned ? "📌 Pinned · " : ""}{formatDate(a.published_at)}</p><h3 className="mt-3 text-xl font-bold">{a.title}</h3><p className="mt-3 line-clamp-4 text-sm leading-6 muted">{a.body}</p></article></Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------------- TESTIMONIES ---------------- */}
      <section id="testimonies" className="lp-section" style={{ background: "var(--surface-subtle)" }}>
        <div className="mx-auto max-w-7xl px-5">
          <Reveal className="flex flex-wrap items-end justify-between gap-6"><div><p className="lp-kicker">God is faithful</p><h2 className="lp-h2 mt-4">Real stories. <em>Real testimonies.</em></h2></div><Link href="/member/testimonies" className="btn btn-secondary">Share yours <ArrowRight size={15} /></Link></Reveal>
          <div className="lp-testimony-track mt-10">
            {(data?.testimonies.length ? data.testimonies : [{ id: "x", title: "Your story could be here", body: "Has God done something amazing in your life? Sign in to the member portal and share your testimony to encourage others.", person: null }]).map((t, i) => (
              <Reveal key={t.id} delay={i * 0.08}><figure className="lp-card h-full p-8"><span className="lp-quote" aria-hidden>“</span><h3 className="mt-2 text-xl font-bold">{t.title}</h3><blockquote className="mt-3 line-clamp-6 leading-7 muted">{t.body}</blockquote><figcaption className="mt-6 text-sm font-semibold">— {t.person?.full_name.split(" ")[0] ?? "FlagUpJesus family"}</figcaption></figure></Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- PRAYER ---------------- */}
      <section id="prayer" className="lp-section lp-dark">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-2">
          <Reveal>
            <p className="lp-kicker !text-red-300">We&apos;ll pray with you</p>
            <h2 className="lp-h2 mt-4">You don&apos;t have to <em className="!text-[#ffd9a0]">carry it alone.</em></h2>
            <p className="mt-6 max-w-lg text-lg leading-8 muted">Our pastoral team reads and prays over every request. Requests stay confidential unless you choose to share them on the prayer wall.</p>
            {data && data.wall.length > 0 && (
              <ul className="mt-8 space-y-3">{data.wall.slice(0, 3).map((p) => <li key={p.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm"><p className="line-clamp-2 text-white/85">{p.request_text}</p><p className="mt-2 text-xs text-white/50">— {p.displayName} · 🙏 {p.prayed_count} praying</p></li>)}</ul>
            )}
          </Reveal>
          <Reveal delay={0.15}><div className="rounded-3xl border border-white/10 bg-white/5 p-7 backdrop-blur"><h3 className="mb-5 text-xl font-bold">Send a prayer request</h3><PrayerForm guest dark /></div></Reveal>
        </div>
      </section>

      {/* ---------------- PARTNER / GIVE ---------------- */}
      <section id="give" className="lp-section">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 lg:grid-cols-2">
          <Reveal>
            <p className="lp-kicker">Partner with us</p>
            <h2 className="lp-h2 mt-4">Fuel the Word <em>and the Works.</em></h2>
            <p className="mt-5 max-w-lg text-lg leading-8 muted">Your tithes, offerings and outreach seeds put medicine in clinics, food in homes and the gospel in villages. Thank you for sowing into the Kingdom.</p>
            <div className="mt-6 grid max-w-md grid-cols-3 gap-3 text-center text-xs font-semibold">
              {[{ I: Stethoscope, t: "Medicines" }, { I: ShoppingBasket, t: "Food packs" }, { I: BookOpen, t: "Gospel" }].map(({ I, t }) => <div key={t} className="lp-card p-4"><I className="mx-auto text-[var(--accent)]" size={20} /><p className="mt-2">{t}</p></div>)}
            </div>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="lp-cta p-8">
              <p className="text-sm text-red-100">Bank transfer</p>
              {settings?.account_number ? (
                <>
                  <p className="mt-6 text-xs uppercase tracking-widest text-white/60">{settings.bank_name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-3"><p className="text-4xl font-extrabold tracking-wider">{settings.account_number}</p><CopyButton value={settings.account_number} className="btn lp-btn-glass btn-sm" /></div>
                  <p className="mt-2 text-white/80">{settings.account_name}</p>
                </>
              ) : <p className="mt-6 text-white/80">Bank details are available from the church office.</p>}
              <p className="relative mt-8 text-xs text-white/60">Members: add your flag username as the narration so we can record it in your giving history. Add “OUTREACH” to sow into the Love Missions.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="px-5 pb-20">
        <Reveal className="mx-auto max-w-7xl">
          <div className="lp-cta relative flex flex-wrap items-center justify-between gap-8 overflow-hidden p-10 sm:p-14">
            <div className="relative max-w-2xl"><h2 className="text-3xl font-extrabold leading-tight sm:text-5xl">You belong here. <span className="font-display italic text-[#ffd9a0]">Come as you are.</span></h2><p className="mt-4 text-white/75">Register in a minute and receive your personal flag username for every service.</p></div>
            <div className="relative flex flex-wrap gap-3"><Link href="/register" className="btn lp-btn-light px-6 py-3">Register now <ArrowRight size={16} /></Link><Link href="/login" className="btn lp-btn-glass px-6 py-3">Sign in</Link></div>
          </div>
        </Reveal>
      </section>

      {/* ---------------- FOOTER ---------------- */}
      <footer className="border-t py-12" style={{ borderColor: "var(--border)" }}>
        <div className="mx-auto grid max-w-7xl gap-8 px-5 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div><BrandLogo className="h-14 w-20 object-contain" /><p className="mt-3 max-w-sm text-sm muted">FlagUpJesus Global Ministry — the Word and the Works, from Port Harcourt to the nations.</p></div>
          <div className="space-y-2 text-sm"><p className="font-bold">Visit</p><p className="flex items-center gap-2 muted"><MapPin size={14} /> {settings?.address ?? "Port Harcourt, Rivers State, Nigeria"}</p>{settings?.contact_phone && <p className="flex items-center gap-2 muted"><Phone size={14} /> {settings.contact_phone}</p>}{settings?.contact_email && <p className="flex items-center gap-2 muted"><Mail size={14} /> {settings.contact_email}</p>}</div>
          <div className="space-y-2 text-sm"><p className="font-bold">Follow</p><a href={LINKS.instagram} target="_blank" rel="noreferrer" className="block muted hover:text-[var(--accent)]">Instagram</a><a href={LINKS.facebook} target="_blank" rel="noreferrer" className="block muted hover:text-[var(--accent)]">Facebook</a><a href={LINKS.site} target="_blank" rel="noreferrer" className="block muted hover:text-[var(--accent)]">umanuwacaleb.com</a></div>
          <div className="space-y-2 text-sm"><p className="font-bold">Quick links</p><Link href="/register" className="block muted hover:text-[var(--accent)]">Register</Link><Link href="/login" className="block muted hover:text-[var(--accent)]">Member portal</Link><Link href="/check-in" className="block muted hover:text-[var(--accent)]">Check-in</Link><Link href="/login?as=staff" className="block muted hover:text-[var(--accent)]">Staff sign in</Link></div>
        </div>
        <p className="mt-10 text-center text-xs" style={{ color: "var(--faint)" }}>© {new Date().getFullYear()} FlagUpJesus Global Ministry. All rights reserved.</p>
      </footer>
    </main>
  );
}
