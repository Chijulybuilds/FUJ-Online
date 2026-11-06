import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, HandHeart, Heart, MapPin, Mail, Music, Phone, PlayCircle, QrCode, ScanLine, Sparkles, Users } from "lucide-react";
import { LandingNav } from "@/components/landing/nav";
import { Countdown } from "@/components/landing/countdown";
import { Counter } from "@/components/landing/counter";
import { Particles } from "@/components/landing/particles";
import { Reveal } from "@/components/shared/reveal";
import { CopyButton } from "@/components/shared/copy-button";
import { PrayerForm } from "@/components/shared/prayer-form";
import { BrandLogo } from "@/components/shared/brand-logo";
import { getSettings, parseServiceTimes } from "@/lib/repo/settings";
import { upcomingService } from "@/lib/repo/services";
import { publishedAnnouncements, publishedTestimonies, prayerWall } from "@/lib/repo/content";
import { db } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SERVICE_ICONS = [Music, BookOpen, HandHeart, Sparkles];

function Words({ text, delay = 0 }: { text: string; delay?: number }) {
  return <>{text.split(" ").map((w, i) => <span className="lp-word" key={i}><span style={{ animationDelay: `${delay + i * 0.08}s` }}>{w}&nbsp;</span></span>)}</>;
}

async function loadLanding() {
  try {
    const [settings, next, news, testimonies, wall, people, services, prayers] = await Promise.all([
      getSettings(), upcomingService(), publishedAnnouncements({ publicOnly: true }), publishedTestimonies(true), prayerWall(),
      db().list("people"), db().list("services"), db().list("prayer_requests")
    ]);
    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    const prayed = prayers.length + prayers.reduce((s, p) => s + (p.prayed_count ?? 0), 0);
    return { settings, next, news, testimonies, wall, stats: { family: people.length, services: services.filter((s) => new Date(s.starts_at) >= yearStart && s.status !== "cancelled").length, prayed } };
  } catch (error) {
    console.error("landing data unavailable", error);
    return null;
  }
}

export default async function HomePage() {
  const data = await loadLanding();
  const settings = data?.settings;
  const times = parseServiceTimes(settings?.service_times ?? "Sunday Celebration Service|Sundays · 9:00 AM\nMidweek Bible Study|Wednesdays · 5:30 PM");
  const live = data?.next?.status === "active";
  const watchUrl = settings?.livestream_url || "#watch";
  const marquee = ["Worship", "The Word", "Prayer", "Fellowship", "Service", "Love", "Family", "Revival"];

  return (
    <main className="lp">
      <LandingNav />

      {/* ---------------- HERO ---------------- */}
      <section className="lp-hero">
        <div className="lp-aurora" aria-hidden><span /><span /><span /></div>
        <div className="lp-rays" aria-hidden />
        <div className="lp-grain" aria-hidden />
        <Particles />
        <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-5 pb-20 pt-32 lg:grid-cols-[1.25fr_.75fr]">
          <div>
            <span className="lp-eyebrow lp-fade"><span className={live ? "live-dot" : "hero-eyebrow-dot"} /> {live ? "LIVE NOW" : "FLAG OF JESUS GLOBAL MINISTRY"}</span>
            <h1 className="lp-title mt-7">
              <Words text="Raise the flag." delay={0.1} /><br />
              <span className="lp-word"><span style={{ animationDelay: ".45s" }}><em>Lift up Jesus.</em></span></span>
            </h1>
            <p className="lp-fade mt-7 max-w-xl text-lg leading-8 text-white/75" style={{ animationDelay: ".7s" }}>
              {settings?.tagline ?? "One church family, connected in faith."} Worship with us in person or online — check in with your <b className="text-white">flag</b> username, share prayer requests and celebrate what God is doing.
            </p>
            <div className="lp-fade mt-9 flex flex-wrap gap-3" style={{ animationDelay: ".85s" }}>
              <a className="btn lp-btn-light px-6 py-3" href={watchUrl} target={settings?.livestream_url ? "_blank" : undefined} rel="noreferrer"><PlayCircle size={18} /> {live ? "Join the live service" : "Watch online"}</a>
              <Link className="btn lp-btn-glass px-6 py-3" href="/register">Plan your first visit <ArrowRight size={17} /></Link>
            </div>
            {data?.next && (
              <div className="lp-fade mt-12" style={{ animationDelay: "1s" }}>
                <p className="mb-3 text-xs font-bold tracking-[.18em] text-white/55">{live ? data.next.title.toUpperCase() : `NEXT: ${data.next.title.toUpperCase()} · ${formatDateTime(data.next.starts_at).toUpperCase()}`}</p>
                <Countdown target={data.next.starts_at} live={live} />
              </div>
            )}
          </div>
          <div className="lp-fade relative hidden lg:block" style={{ animationDelay: ".6s" }}>
            <div className="lp-float mx-auto w-fit">
              <div className="lp-phone">
                <div className="bg-[#120d0e] px-5 pb-6 pt-8 text-white">
                  <p className="text-[10px] tracking-[.2em] text-red-200">SUNDAY CHECK-IN</p>
                  <p className="mt-2 text-lg font-bold">Welcome back! 👋</p>
                </div>
                <div className="space-y-3 p-5">
                  <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>Your username</p>
                  <div className="input username-badge text-sm">flaggrace101<span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-current align-middle" /></div>
                  <div className="btn btn-primary w-full">Check in</div>
                  <div className="alert alert-ok text-center text-xs">✓ You&apos;re checked in, Grace!</div>
                </div>
              </div>
            </div>
            <div className="absolute -left-6 top-10 rounded-2xl border border-white/15 bg-white/10 p-4 text-white backdrop-blur lp-float" style={{ animationDelay: "-2s" }}><QrCode className="text-red-200" /><p className="mt-2 text-xs">QR refreshes<br /><b>every 20s</b></p></div>
            <div className="absolute -right-4 bottom-10 rounded-2xl border border-white/15 bg-white/10 p-4 text-white backdrop-blur lp-float" style={{ animationDelay: "-4s" }}><Heart className="text-red-200" /><p className="mt-2 text-xs"><b>{data?.stats.prayed ?? 0}</b> prayers<br />lifted up</p></div>
          </div>
        </div>
        <a href="#welcome" className="absolute bottom-8 left-1/2 -translate-x-1/2" aria-label="Scroll down"><span className="lp-scroll-cue block" /></a>
      </section>

      {/* ---------------- MARQUEE ---------------- */}
      <div className="lp-marquee" aria-hidden>
        <div className="lp-marquee-track">{[...marquee, ...marquee].map((w, i) => <span key={i}>{w} <span className="mx-4 text-[var(--accent)]">✦</span></span>)}</div>
      </div>

      {/* ---------------- WELCOME ---------------- */}
      <section id="welcome" className="lp-section">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 lg:grid-cols-2">
          <Reveal>
            <p className="lp-kicker">Welcome home</p>
            <h2 className="lp-h2 mt-4">A church family where <em>you belong.</em></h2>
            <p className="mt-6 max-w-xl text-lg leading-8 muted">Flag of Jesus Global Ministry is a community raising the banner of Jesus — through passionate worship, the uncompromised Word, fervent prayer and genuine love for one another. Whether it&apos;s your first visit or your hundredth, there&apos;s a seat with your name on it.</p>
            <div className="mt-8 flex flex-wrap gap-3"><Link href="/register" className="btn btn-primary px-5 py-3">Join the family <ArrowRight size={16} /></Link><a href="#services" className="btn btn-secondary px-5 py-3">Service times</a></div>
          </Reveal>
          <div className="grid grid-cols-2 gap-4">
            {[{ v: data?.stats.family ?? 0, l: "Members & friends", I: Users }, { v: data?.stats.services ?? 0, l: "Services this year", I: CalendarDays }, { v: data?.stats.prayed ?? 0, l: "Prayers lifted", I: HandHeart }, { v: data?.testimonies.length ?? 0, l: "Testimonies shared", I: Sparkles }].map(({ v, l, I }, i) => (
              <Reveal key={l} delay={i * 0.1} className={i % 2 ? "translate-y-8" : ""}>
                <div className="lp-card p-6"><span className="lp-icon"><I size={22} /></span><p className="mt-6 text-4xl font-extrabold tracking-tight"><Counter value={v} /></p><p className="mt-1 text-sm muted">{l}</p></div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- SERVICES ---------------- */}
      <section id="services" className="lp-section pt-0">
        <div className="mx-auto max-w-7xl px-5">
          <Reveal className="text-center"><p className="lp-kicker">Gather with us</p><h2 className="lp-h2 mt-4">Service <em>times</em></h2></Reveal>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {times.map((t, i) => {
              const I = SERVICE_ICONS[i % SERVICE_ICONS.length];
              return (
                <Reveal key={t.name + i} delay={i * 0.1}>
                  <div className="lp-card h-full p-7"><span className="lp-icon"><I size={22} /></span><h3 className="mt-6 text-xl font-bold">{t.name}</h3><p className="mt-2 muted">{t.when}</p>{settings?.address && <p className="mt-4 flex items-center gap-2 text-xs muted"><MapPin size={13} /> {settings.address}</p>}</div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------------- WATCH ---------------- */}
      <section id="watch" className="lp-section lp-dark relative overflow-hidden">
        <div className="lp-aurora opacity-50" aria-hidden><span /><span /><span /></div>
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 lg:grid-cols-2">
          <Reveal>
            <p className="lp-kicker !text-red-300">Online church</p>
            <h2 className="lp-h2 mt-4">Can&apos;t make it in person? <em className="!text-[#ffd9a0]">Worship online.</em></h2>
            <p className="mt-6 max-w-lg text-lg leading-8 muted">Join every service live from wherever you are. Send prayer requests, follow announcements and stay connected through the member portal.</p>
            <a href={watchUrl} target={settings?.livestream_url ? "_blank" : undefined} rel="noreferrer" className="btn lp-btn-light mt-8 px-6 py-3"><PlayCircle size={18} /> {live ? "Watch live now" : "Go to our channel"}</a>
          </Reveal>
          <Reveal delay={0.15}>
            <a href={watchUrl} target={settings?.livestream_url ? "_blank" : undefined} rel="noreferrer" className="group relative block aspect-video overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#3a0d12] to-[#0d0a0b] shadow-2xl">
              <div className="lp-rays opacity-70" aria-hidden />
              <div className="absolute inset-0 grid place-items-center"><span className="grid h-24 w-24 place-items-center rounded-full bg-white/95 text-[#bd1722] shadow-[0_0_0_18px_rgba(255,255,255,.08)] transition duration-500 group-hover:scale-110"><PlayCircle size={46} /></span></div>
              <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between text-sm"><span className="flex items-center gap-2">{live ? <><span className="live-dot" /> LIVE</> : "Next broadcast"}</span><span className="text-white/60">{data?.next ? formatDateTime(data.next.starts_at) : "Every Sunday"}</span></div>
            </a>
          </Reveal>
        </div>
      </section>

      {/* ---------------- CHECK-IN HOW-TO ---------------- */}
      <section id="checkin" className="lp-section">
        <div className="mx-auto max-w-7xl px-5">
          <Reveal className="max-w-2xl"><p className="lp-kicker">Sunday check-in</p><h2 className="lp-h2 mt-4">Scan. Type your username. <em>You&apos;re in.</em></h2><p className="mt-5 text-lg muted">No more SMS codes every Sunday. Register once, receive your personal <b>flag</b> username, and use it at every service.</p></Reveal>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[{ I: ScanLine, t: "Scan the live QR", d: "Point your camera at the code on the screen. It refreshes every 20 seconds, so it only works in the room." },
              { I: Sparkles, t: "Type your flag username", d: "e.g. flaggrace101 — you get it the first time you register. Save it in your notes!" },
              { I: Heart, t: "You're counted & cared for", d: "Your attendance helps our pastors notice when you're missing and reach out with love." }].map(({ I, t, d }, i) => (
              <Reveal key={t} delay={i * 0.12}><div className="lp-card relative h-full overflow-hidden p-7"><span className="lp-step-num absolute right-5 top-3">{i + 1}</span><span className="lp-icon"><I size={22} /></span><h3 className="mt-6 text-xl font-bold">{t}</h3><p className="mt-2 text-sm leading-6 muted">{d}</p></div></Reveal>
            ))}
          </div>
          <Reveal className="mt-10 flex flex-wrap gap-3" delay={0.2}><Link href="/register" className="btn btn-primary px-5 py-3">Get my username</Link><Link href="/login" className="btn btn-secondary px-5 py-3">Member sign in</Link></Reveal>
        </div>
      </section>

      {/* ---------------- ANNOUNCEMENTS ---------------- */}
      {data && data.news.length > 0 && (
        <section className="lp-section pt-0">
          <div className="mx-auto max-w-7xl px-5">
            <Reveal><p className="lp-kicker">What&apos;s happening</p><h2 className="lp-h2 mt-4">Church <em>news</em></h2></Reveal>
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
            {(data?.testimonies.length ? data.testimonies : [{ id: "x", title: "Your story could be here", body: "Has God done something amazing in your life? Sign in to the member portal and share your testimony to encourage others.", person: null, featured: false, published_at: null }]).map((t, i) => (
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
            <p className="mt-6 max-w-lg text-lg leading-8 muted">Our pastoral team reads and prays over every request. Requests are confidential unless you choose to share them on the prayer wall.</p>
            {data && data.wall.length > 0 && (
              <ul className="mt-8 space-y-3">{data.wall.slice(0, 3).map((p) => <li key={p.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm"><p className="line-clamp-2 text-white/85">{p.request_text}</p><p className="mt-2 text-xs text-white/50">— {p.displayName} · 🙏 {p.prayed_count} praying</p></li>)}</ul>
            )}
          </Reveal>
          <Reveal delay={0.15}><div className="rounded-3xl border border-white/10 bg-white/5 p-7 backdrop-blur"><h3 className="mb-5 text-xl font-bold">Send a prayer request</h3><PrayerForm guest dark /></div></Reveal>
        </div>
      </section>

      {/* ---------------- GIVE ---------------- */}
      <section id="give" className="lp-section">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 lg:grid-cols-2">
          <Reveal><p className="lp-kicker">Partner with us</p><h2 className="lp-h2 mt-4">Give <em>cheerfully.</em></h2><p className="mt-5 max-w-lg text-lg leading-8 muted">Your tithes and offerings fuel worship, outreach and care for families in our community. Thank you for sowing into the work of the Kingdom.</p><p className="mt-4 text-sm muted">“God loves a cheerful giver.” — 2 Corinthians 9:7</p></Reveal>
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
              <p className="relative mt-8 text-xs text-white/60">Members: add your flag username as the narration so we can record it in your giving history.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="px-5 pb-20">
        <Reveal className="mx-auto max-w-7xl">
          <div className="lp-cta flex flex-wrap items-center justify-between gap-8 p-10 sm:p-14">
            <div className="relative max-w-2xl"><h2 className="text-3xl font-extrabold leading-tight sm:text-5xl">You belong here. <span className="font-display italic text-[#ffd9a0]">Come as you are.</span></h2><p className="mt-4 text-white/75">Register in a minute and receive your personal flag username for every service.</p></div>
            <div className="relative flex flex-wrap gap-3"><Link href="/register" className="btn lp-btn-light px-6 py-3">Register now <ArrowRight size={16} /></Link><Link href="/login" className="btn lp-btn-glass px-6 py-3">Sign in</Link></div>
          </div>
        </Reveal>
      </section>

      {/* ---------------- FOOTER ---------------- */}
      <footer className="border-t py-12" style={{ borderColor: "var(--border)" }}>
        <div className="mx-auto grid max-w-7xl gap-8 px-5 md:grid-cols-[1.5fr_1fr_1fr]">
          <div><BrandLogo className="h-14 w-20 object-contain" /><p className="mt-3 max-w-sm text-sm muted">{settings?.church_name ?? "Flag of Jesus Global Ministry"} — {settings?.tagline ?? "Raising the flag of Jesus in every nation."}</p></div>
          <div className="space-y-2 text-sm"><p className="font-bold">Visit</p>{settings?.address && <p className="flex items-center gap-2 muted"><MapPin size={14} /> {settings.address}</p>}{settings?.contact_phone && <p className="flex items-center gap-2 muted"><Phone size={14} /> {settings.contact_phone}</p>}{settings?.contact_email && <p className="flex items-center gap-2 muted"><Mail size={14} /> {settings.contact_email}</p>}</div>
          <div className="space-y-2 text-sm"><p className="font-bold">Quick links</p><Link href="/register" className="block muted hover:text-[var(--accent)]">Register</Link><Link href="/login" className="block muted hover:text-[var(--accent)]">Member portal</Link><Link href="/check-in" className="block muted hover:text-[var(--accent)]">Check-in</Link><Link href="/login?as=staff" className="block muted hover:text-[var(--accent)]">Staff sign in</Link></div>
        </div>
        <p className="mt-10 text-center text-xs" style={{ color: "var(--faint)" }}>© {new Date().getFullYear()} Flag of Jesus Global Ministry · FlagUpJesus. All rights reserved.</p>
      </footer>
    </main>
  );
}
