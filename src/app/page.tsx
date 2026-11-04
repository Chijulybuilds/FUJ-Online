import Link from "next/link";
import { ArrowRight, Church, HeartHandshake, QrCode, Users } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const highlights = [
  { title: "Community", description: "Stay connected", Icon: Users },
  { title: "Check-in", description: "Simple attendance", Icon: QrCode }
];

export default function HomePage() {
  return (
    <main className="landing-page min-h-screen overflow-hidden">
      <nav className="landing-nav mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" aria-label="FlagUpJesus home">
          <BrandLogo className="h-14 w-20 object-contain sm:h-16 sm:w-24" priority />
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link className="btn btn-secondary" href="/login">
            Sign in <ArrowRight size={15} />
          </Link>
        </div>
      </nav>

      <section className="landing-hero mx-auto grid max-w-7xl items-center gap-12 px-6 pb-20 pt-10 lg:grid-cols-[1.15fr_0.85fr] lg:pb-28 lg:pt-14">
        <div className="hero-content">
          <span className="hero-eyebrow">
            <span className="hero-eyebrow-dot" />
            FLAG OF JESUS GLOBAL MINISTRY
          </span>
          <h1 className="hero-title mt-7 max-w-3xl text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl xl:text-[4rem]">
            One church family.
            <span className="hero-title-accent">Connected in faith.</span>
          </h1>
          <p className="hero-copy mt-6 max-w-lg text-lg leading-8">
            A simpler way to stay connected with your church community, follow ministry updates, and keep track of your church journey.
          </p>
          <div className="hero-actions mt-9 flex flex-wrap gap-3">
            <Link className="btn btn-primary px-6 py-3" href="/register">
              Join our community <ArrowRight size={17} />
            </Link>
            <Link className="btn btn-secondary px-6 py-3" href="/admin">
              Admin portal
            </Link>
          </div>
          <p className="hero-motto mt-5 text-xs">Faith · Fellowship · Service</p>
        </div>

        <div className="hero-visual">
          <div className="hero-orb" />
          <div className="hero-visual-card brand-panel">
            <div className="flex items-center justify-between">
              <div>
                <p className="hero-card-kicker text-sm">Welcome to your church</p>
                <p className="mt-1 text-2xl font-bold">Growing together</p>
              </div>
              <Church size={34} className="hero-card-icon" />
            </div>
            <div className="mt-8 grid grid-cols-2 gap-3">
              {highlights.map(({ title, description, Icon }, index) => (
                <div className={`hero-highlight hero-highlight-${index + 1} rounded-2xl p-5`} key={title}>
                  <Icon className="hero-card-icon" />
                  <p className="mt-5 text-2xl font-bold">{title}</p>
                  <p className="mt-1 text-xs text-slate-300">{description}</p>
                </div>
              ))}
              <div className="hero-welcome col-span-2 rounded-2xl p-5">
                <HeartHandshake />
                <p className="mt-3 font-semibold">You belong here.</p>
                <p className="mt-1 text-sm text-red-100">A community walking together in faith.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="landing-footer border-t py-6 text-center text-xs">
        © {new Date().getFullYear()} Flag of Jesus Global Ministry. All rights reserved.
      </footer>
    </main>
  );
}
