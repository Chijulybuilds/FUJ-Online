"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const LINKS = [["#services", "Services"], ["#watch", "Watch"], ["#checkin", "Check-in"], ["#testimonies", "Testimonies"], ["#prayer", "Prayer"], ["#give", "Give"]];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll(); window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const light = !scrolled && !open;
  return (
    <header className={`lp-nav ${scrolled || open ? "scrolled" : ""}`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/" aria-label="FlagUpJesus home" className={`rounded-xl px-1 ${light ? "bg-white/90" : ""}`}><BrandLogo className="h-12 w-[72px] object-contain" priority /></Link>
        <nav className="hidden items-center gap-7 lg:flex">{LINKS.map(([h, l]) => <a key={h} href={h} className={`lp-link ${light ? "!text-white/80 hover:!text-white" : ""}`}>{l}</a>)}</nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link className={`btn btn-sm hidden sm:inline-flex ${light ? "lp-btn-glass" : "btn-secondary"}`} href="/login">Sign in</Link>
          <Link className="btn btn-primary btn-sm" href="/register">I&apos;m new <ArrowRight size={14} /></Link>
          <button className={`btn btn-sm lg:hidden ${light ? "lp-btn-glass" : "btn-secondary"}`} aria-label="Menu" onClick={() => setOpen((v) => !v)}>{open ? <X size={16} /> : <Menu size={16} />}</button>
        </div>
      </div>
      {open && <nav className="grid gap-1 border-t px-5 pb-4 pt-2 lg:hidden" style={{ borderColor: "var(--border)" }}>{LINKS.map(([h, l]) => <a key={h} href={h} onClick={() => setOpen(false)} className="lp-link rounded-lg px-2 py-2">{l}</a>)}<Link href="/login" className="lp-link rounded-lg px-2 py-2">Sign in</Link></nav>}
    </header>
  );
}
