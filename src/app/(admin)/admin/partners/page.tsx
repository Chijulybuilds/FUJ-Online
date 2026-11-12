import Link from "next/link";
import { Download, Globe2, HandCoins, Send, Users } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { StatusPill } from "@/components/ui/status-pill";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { COUNTRIES, CURRENCIES, FREQUENCIES, frequencyLabel, listPartners, monthlyEquivalent, PARTNER_STATUSES, PARTNER_STREAMS, type PartnerRow } from "@/lib/repo/partners";
import { getSettings } from "@/lib/repo/settings";
import { deliveredVia, followUpChannels } from "@/lib/repo/contact-logs";
import { addPartnerAction, runPartnerAction } from "@/lib/actions/admin";
import { db } from "@/lib/db";
import type { ChurchSettings, Donation, PartnerStream } from "@/lib/db/types";
import { formatAmounts, formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ACTIVE = new Set(["interested", "contacted", "committed", "active", "paused"]);

export default async function PartnersPage({ searchParams }: { searchParams: Promise<{ status?: string; stream?: string }> }) {
  const admin = await requireAdmin("partners");
  const { status = "", stream: streamParam = "" } = await searchParams;
  const stream: PartnerStream = streamParam === "associate" ? "associate" : "outreach";
  let all: PartnerRow[]; let settings: ChurchSettings; let donations: Donation[];
  try {
    [all, settings] = await Promise.all([listPartners(), getSettings()]);
    donations = all.length ? await db().list("donations", { where: { person_id: all.map((r) => r.person_id), status: "paid" } }) : [];
  } catch (error) {
    console.error("partners unavailable", error);
    return (
      <>
        <PageHeading title="FUJ Partners" description="Follow up people who support the ministry through regular giving." />
        <div className="alert alert-warn" data-testid="partners-db-update">
          The database needs a one-time update before partners can be saved. In Supabase, open <b>SQL Editor → New query</b>, paste everything from
          <code className="mx-1">supabase/setup.sql</code>and click <b>Run</b>, then refresh this page.
        </div>
      </>
    );
  }
  const info = PARTNER_STREAMS.find((s) => s.value === stream)!;
  const rows = all.filter((r) => r.stream === stream);
  const count = (s: PartnerStream) => all.filter((r) => r.stream === s && ACTIVE.has(r.status)).length;
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 3600000);
  const current = rows.filter((r) => ACTIVE.has(r.status));
  const shown = status === "all" ? rows : status ? rows.filter((r) => r.status === status) : current;
  // Totals per currency: associates abroad pledge in pounds, dollars…, never added to naira.
  const pledged = new Map<string, number>();
  rows.filter((r) => r.status === "committed" || r.status === "active").forEach((r) => pledged.set(r.currency, (pledged.get(r.currency) ?? 0) + monthlyEquivalent(r)));
  const ids = new Set(rows.map((r) => r.person_id));
  const given = new Map<string, number>();
  donations.filter((d) => d.person_id && ids.has(d.person_id) && d.paid_at && new Date(d.paid_at) >= monthStart).forEach((d) => given.set(d.currency || "NGN", (given.get(d.currency || "NGN") ?? 0) + Number(d.amount)));
  const isDue = (r: PartnerRow) => r.status !== "declined" && Boolean(r.next_follow_up_at) && new Date(r.next_follow_up_at!) <= now;
  const due = rows.filter(isDue).length;
  const committed = all.filter((r) => r.status === "committed" || r.status === "active").length;
  const via = deliveredVia(followUpChannels(settings)).join(" · ");
  // Zero totals in the currency most of this stream's partners use (pounds, dollars… for associates).
  const usual = [...rows.reduce((m, r) => m.set(r.currency, (m.get(r.currency) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "NGN";
  const href = (q: Record<string, string>) => `/admin/partners?${new URLSearchParams({ stream, ...q })}`;
  const associate = stream === "associate";

  return (
    <>
      <PageHeading
        title="FUJ Partners"
        description="Two kinds of partners: outreach partners are FlagUpJesus members; associate partners are key partners outside FlagUpJesus — in the UK, the US and around the world."
        action={<>
          {all.length > 0 && <a href={`/api/admin/export?type=partners&stream=${stream}`} className="btn btn-secondary"><Download size={16} /> {info.short} partners (CSV)</a>}
          {can(admin.role, "messaging") && current.length > 0 && <Link href={`/admin/messaging?audience=partners_${stream}`} className="btn btn-secondary" data-testid="message-partners"><Send size={16} /> Message {info.short.toLowerCase()} partners</Link>}
          <ActionForm action={runPartnerAction}><input type="hidden" name="mode" value="due" /><SubmitButton pendingText="Sending…">Send due messages</SubmitButton></ActionForm>
        </>}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2" role="tablist" aria-label="Partner type" data-testid="partner-streams">
        {PARTNER_STREAMS.map((s) => {
          const Icon = s.value === "associate" ? Globe2 : Users;
          const on = s.value === stream;
          return (
            <Link key={s.value} href={`/admin/partners?stream=${s.value}`} role="tab" aria-selected={on} data-testid={`stream-${s.value}`}
              className={`card flex items-center gap-4 p-4 transition hover:-translate-y-0.5 ${on ? "ring-2 ring-[var(--accent)]" : ""}`}>
              <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${on ? "bg-[var(--accent)] text-white" : "bg-slate-100 text-slate-600"}`}><Icon size={20} /></span>
              <span className="min-w-0 flex-1"><b className="block">{s.label}</b><span className="block text-xs text-slate-500">{s.hint}</span></span>
              <b className="text-2xl">{count(s.value)}</b>
            </Link>
          );
        })}
      </div>

      <div className={`alert mb-5 flex flex-wrap items-center justify-between gap-3 ${settings.partner_auto ? "alert-ok" : "alert-warn"}`} data-testid="partner-automation">
        <span>
          {settings.partner_auto ? <><b>Thank-you messages are on.</b> New partners are thanked straight away ({via}) and appear here for your team to call within 3 days.</> : <><b>Thank-you messages are off.</b></>}{" "}
          {settings.partner_reminders
            ? <>Reminders with the giving details go out on day <b>{settings.partner_reminder_day}</b> of each month to committed and active partners who haven&apos;t given yet{settings.associate_giving_details ? " — associates get the international details" : ""}.</>
            : <>Monthly partnership reminders are <b>off</b>.</>}
        </span>
        <span className="flex flex-wrap gap-2">
          {committed > 0 && <ActionForm action={runPartnerAction}><input type="hidden" name="mode" value="reminders" /><SubmitButton className="btn btn-secondary btn-sm" pendingText="Sending…">Send reminders now</SubmitButton></ActionForm>}
          <Link href="/admin/settings#first-timers-partners" className="btn btn-secondary btn-sm">Change</Link>
        </span>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card p-4"><p className="text-xs text-slate-500">{info.label}</p><p className="text-2xl font-bold" data-testid="partners-count">{current.length}</p><p className="text-xs text-slate-400">{rows.filter((r) => r.status === "committed" || r.status === "active").length} committed or active</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Pledged per month</p><p className="text-2xl font-bold" data-testid="partners-pledged">{formatAmounts(pledged, usual)}</p><p className="text-xs text-slate-400">Committed &amp; active pledges</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Given this month</p><p className="text-2xl font-bold">{formatAmounts(given, usual)}</p><p className="text-xs text-slate-400">From Admin → Giving records</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Follow-ups due</p><p className={`text-2xl font-bold ${due ? "text-red-600" : ""}`}>{due}</p><p className="text-xs text-slate-400">Calls planned for today or earlier</p></div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)]">
        <section className="card h-fit p-6" data-testid="add-partner">
          <h2 className="mb-1 flex items-center gap-2 font-bold"><HandCoins size={18} className="text-[var(--accent,#c8102e)]" /> Add {associate ? "an associate" : "an outreach"} partner</h2>
          <p className="mb-4 text-xs text-slate-500">
            {associate
              ? "Someone outside FlagUpJesus — anywhere in the world. They get messages and a giving history here, but aren't added to the members list."
              : "A FlagUpJesus member. If they're registered with this number, their member record is linked; if not, they're registered as a member."}
          </p>
          <ActionForm action={addPartnerAction} className="grid gap-3">
            <input type="hidden" name="stream" value={stream} />
            <label className="label">Full name<input className="input mt-1" name="full_name" required placeholder="Partner's full name" /></label>
            {associate && <label className="label">Church / organisation <span className="font-normal text-slate-400">(optional)</span><input className="input mt-1" name="organisation" placeholder="e.g. Grace Chapel, London" /></label>}
            {associate && (
              <label className="label">Country<input className="input mt-1" name="country" list="partner-countries" required placeholder="e.g. United Kingdom" />
                <datalist id="partner-countries">{COUNTRIES.map((c) => <option key={c} value={c} />)}</datalist>
              </label>
            )}
            <label className="label">{associate ? "WhatsApp / phone number" : "Phone number"}{associate && <span className="hint">With the country code, e.g. +44 7700 900123</span>}<input className="input mt-1" name="phone" required inputMode="tel" placeholder={associate ? "+44 7700 900123" : "0803 000 0000"} /></label>
            <label className="label">Email <span className="font-normal text-slate-400">(optional)</span><input className="input mt-1" name="email" type="email" /></label>
            <div className={`grid gap-3 ${associate ? "grid-cols-[6rem_1fr]" : "grid-cols-2"}`}>
              {associate && <label className="label">Currency<select className="input mt-1" name="currency" defaultValue="GBP">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></label>}
              <label className="label">Pledge{!associate && " (₦)"} <span className="font-normal text-slate-400">(optional)</span><input className="input mt-1" name="pledge_amount" inputMode="decimal" placeholder={associate ? "e.g. 100" : "e.g. 20,000"} /></label>
              {!associate && <label className="label">How often<select className="input mt-1" name="frequency" defaultValue="monthly"><option value="">Not decided</option>{FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select></label>}
            </div>
            {associate && <label className="label">How often<select className="input mt-1" name="frequency" defaultValue="monthly"><option value="">Not decided</option>{FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select></label>}
            <label className="checkbox"><input type="checkbox" name="send_thanks" defaultChecked /> <span>Send them the thank-you message</span></label>
            <div><SubmitButton pendingText="Adding…">Add {associate ? "associate" : "outreach"} partner</SubmitButton></div>
          </ActionForm>
        </section>

        <section className="card">
          <div className="tabs flex-wrap border-b border-slate-100 px-5 py-3">
            <Link href={href({})} className={`tab ${!status ? "active" : ""}`}>Current ({current.length})</Link>
            {PARTNER_STATUSES.map((s) => <Link key={s.value} href={href({ status: s.value })} className={`tab ${status === s.value ? "active" : ""}`} title={s.hint}>{s.label} ({rows.filter((r) => r.status === s.value).length})</Link>)}
            <Link href={href({ status: "all" })} className={`tab ${status === "all" ? "active" : ""}`}>All ({rows.length})</Link>
          </div>
          <div className="table-wrap">
            <table className="data-table" data-testid="partners-table">
              <thead><tr><th>Partner</th>{associate && <th>Where</th>}<th>Status</th><th>Pledge</th><th>Given</th><th>Next follow-up</th></tr></thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td><Link href={`/admin/partners/${r.id}`} className="font-semibold hover:text-blue-600">{r.person.full_name}</Link><span className="block text-xs text-slate-400">{r.person.phone}</span></td>
                    {associate && <td>{r.country ?? "—"}{r.organisation && <span className="block text-xs text-slate-400">{r.organisation}</span>}</td>}
                    <td><StatusPill value={r.status} /><span className="block text-xs text-slate-400">{r.source === "registration" ? "At registration" : r.source === "portal" ? "From their portal" : "Added by staff"}</span></td>
                    <td>{r.pledge_amount ? <><b>{formatCurrency(r.pledge_amount, r.currency)}</b><span className="block text-xs text-slate-400">{frequencyLabel(r.frequency)}</span></> : <span className="text-slate-400">—</span>}</td>
                    <td>{r.given ? <><b>{formatCurrency(r.given, r.currency)}</b><span className="block text-xs text-slate-400">last {formatDate(r.last_gift_at)}</span></> : <span className="text-slate-400">Nothing yet</span>}</td>
                    <td className={isDue(r) ? "font-semibold text-red-600" : ""}>{r.next_follow_up_at ? formatDate(r.next_follow_up_at) : "—"}{isDue(r) && <span className="block text-xs">Due</span>}{r.assignee && <span className="block text-xs font-normal text-slate-400">{r.assignee}</span>}</td>
                  </tr>
                ))}
                {!shown.length && <tr><td colSpan={associate ? 6 : 5} className="py-10 text-center text-slate-500">{rows.length ? "No partners with this status." : associate ? "No associate partners yet. Add partners from outside FlagUpJesus — in the UK, the US or anywhere — with the form." : "No outreach partners yet. When a member ticks “I'd like to become a FUJ Partner” at registration or in their portal, they appear here."}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
