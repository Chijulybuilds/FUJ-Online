import { BookOpen, CalendarClock, Flame, Globe2, HandHeart, PartyPopper, Sparkles, Users, Utensils, Wifi, type LucideIcon } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { Placeholder } from "@/components/ui/placeholder";
import type { Program } from "@/lib/programs";

/** Picks an icon from the programme name (falls back to a book). */
function iconFor(name: string): LucideIcon {
  const n = name.toLowerCase();
  if (n.includes("online")) return Wifi;
  if (n.includes("conference") || n.includes("mission")) return Globe2;
  if (n.includes("prayer")) return HandHeart;
  if (n.includes("family") || n.includes("table") || n.includes("tft")) return Utensils;
  if (n.includes("connect")) return Users;
  if (n.includes("forge") || n.includes("retreat")) return Flame;
  if (n.includes("festival")) return PartyPopper;
  if (n.includes("word")) return BookOpen;
  return Sparkles;
}

/** Weekly / Monthly / Quarterly / Annual — read from the schedule text itself. */
function rhythm(when: string) {
  const w = when.toLowerCase();
  if (/annual|yearly|every (january|february|march|april|may|june|july|august|september|october|november|december)/.test(w)) return "Annual";
  if (w.includes("quarter")) return "Quarterly";
  if (w.includes("month")) return "Monthly";
  if (/every (sunday|monday|tuesday|wednesday|thursday|friday|saturday)|weekly/.test(w)) return "Weekly";
  return null;
}

export function Programs({ programs }: { programs: Program[] }) {
  return (
    <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4" data-testid="programs">
      {programs.map((p, k) => {
        const Icon = iconFor(p.name);
        const tag = rhythm(p.when);
        const pending = !p.when || /^\[.*\]$/.test(p.when);
        return (
          <Reveal key={p.name + k} delay={(k % 4) * 0.08}>
            <article className="gathering h-full" data-testid="program-card">
              <div className="relative flex items-start justify-between gap-2"><span className="lp-icon"><Icon size={22} /></span>{tag && <span className="pill pill-blue">{tag}</span>}</div>
              <div className="relative mt-6">
                <h3 className="text-xl font-bold leading-tight">{p.name}</h3>
                {p.description && <p className="mt-2 text-sm leading-6 muted">{p.description}</p>}
                <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
                  <CalendarClock size={15} className="shrink-0" />
                  {pending ? <Placeholder>{p.when ? p.when.slice(1, -1) : "schedule"}</Placeholder> : p.when}
                </p>
              </div>
            </article>
          </Reveal>
        );
      })}
    </div>
  );
}
