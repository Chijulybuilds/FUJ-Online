import Link from "next/link";
import { Download, HandCoins, Send } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { StatusPill } from "@/components/ui/status-pill";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { FREQUENCIES, frequencyLabel, listPartners, monthlyEquivalent, PARTNER_STATUSES, type PartnerRow } from "@/lib/repo/partners";
import { getSettings } from "@/lib/repo/settings";
import { followUpChannels } from "@/lib/repo/auto-follow-up";
import { deliveredVia } from "@/lib/repo/contact-logs";
import { addPartnerAction, runPartnerAction } from "@/lib/actions/admin";
import { db } from "@/lib/db";
import type { ChurchSettings, Donation } from "@/lib/db/types";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ACTIVE = new Set(["interested", "contacted", "committed", "active", "paused"]);

export default async function PartnersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const admin = await requireAdmin("partners");
  const { status = "" } = await searchParams;
  let rows: PartnerRow[]; let settings: ChurchSettings; let donations: Donation[];
  try {
    [rows, settings] = await Promise.all([listPartners(), getSettings()]);
    donations = rows.length ? await db().list("donations", { where: { person_id: rows.map((r) => r.person_id), status: "paid" } }) : [];
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
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 3600000);
  const current = rows.filter((r) => ACTIVE.has(r.status));
  const shown = status === "all" ? rows : status ? rows.filter((r) => r.status === status) : current;
  const pledgedMonthly = rows.filter((r) => r.status === "committed" || r.status === "active").reduce((s, r) => s + monthlyEquivalent(r), 0);
  const givenThisMonth = donations.filter((d) => d.paid_at && new Date(d.paid_at) >= monthStart).reduce((s, d) => s + Number(d.amount), 0);
  const isDue = (r: PartnerRow) => r.status !== "declined" && Boolean(r.next_follow_up_at) && new Date(r.next_follow_up_at!) <= now;
  const due = rows.filter(isDue).length;
  const committed = rows.filter((r) => r.status === "committed" || r.status === "active").length;
  const via = deliveredVia(followUpChannels(settings)).join(" · ");

  return (
    <>
      <PageHeading
        title="FUJ Partners"
        description="People partnering with the ministry through regular giving. Reach out, record their pledge, see what they've given, and follow up."
        action={<>
          {rows.length > 0 && <a href="/api/admin/export?type=partners" className="btn btn-secondary"><Download size={16} /> Partners (CSV)</a>}
          {can(admin.role, "messaging") && current.length > 0 && <Link href="/admin/messaging?audience=partners" className="btn btn-secondary" data-testid="message-partners"><Send size={16} /> Message partners</Link>}
          <ActionForm action={runPartnerAction}><input type="hidden" name="mode" value="due" /><SubmitButton pendingText="Sending…">Send due messages</SubmitButton></ActionForm>
        </>}
      />
      <div className={`alert mb-5 flex flex-wrap items-center justify-between gap-3 ${settings.partner_auto ? "alert-ok" : "alert-warn"}`} data-testid="partner-automation">
        <span>
          {settings.partner_auto ? <><b>Thank-you messages are on.</b> Everyone who signs up to partner is thanked straight away ({via}) and appears here for your team to call within 3 days.</> : <><b>Thank-you messages are off.</b></>}{" "}
          {settings.partner_reminders
            ? <>Monthly reminders with the ministry&apos;s bank details go out on day <b>{settings.partner_reminder_day}</b> of each month to committed and active partners who haven&apos;t given yet.</>
            : <>Monthly partnership reminders are <b>off</b>.</>}
        </span>
        <span className="flex flex-wrap gap-2">
          {committed > 0 && <ActionForm action={runPartnerAction}><input type="hidden" name="mode" value="reminders" /><SubmitButton className="btn btn-secondary btn-sm" pendingText="Sending…">Send reminders now</SubmitButton></ActionForm>}
          <Link href="/admin/settings#first-timers-partners" className="btn btn-secondary btn-sm">Change</Link>
        </span>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card p-4"><p className="text-xs text-slate-500">Partners</p><p className="text-2xl font-bold" data-testid="partners-count">{current.length}</p><p className="text-xs text-slate-400">{committed} committed or active</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Pledged per month</p><p className="text-2xl font-bold">{formatCurrency(pledgedMonthly)}</p><p className="text-xs text-slate-400">Committed &amp; active pledges</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Given by partners this month</p><p className="text-2xl font-bold">{formatCurrency(givenThisMonth)}</p><p className="text-xs text-slate-400">From Admin → Giving records</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Follow-ups due</p><p className={`text-2xl font-bold ${due ? "text-red-600" : ""}`}>{due}</p><p className="text-xs text-slate-400">Calls planned for today or earlier</p></div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)]">
        <section className="card h-fit p-6">
          <h2 className="mb-1 flex items-center gap-2 font-bold"><HandCoins size={18} className="text-[var(--accent,#c8102e)]" /> Add a partner</h2>
          <p className="mb-4 text-xs text-slate-500">Someone who told you in person. If they&apos;re already registered with this number, their member record is linked.</p>
          <ActionForm action={addPartnerAction} className="grid gap-3">
            <label className="label">Full name<input className="input mt-1" name="full_name" required placeholder="Partner's full name" /></label>
            <label className="label">Phone number<input className="input mt-1" name="phone" required inputMode="tel" placeholder="0803 000 0000" /></label>
            <label className="label">Email <span className="font-normal text-slate-400">(optional)</span><input className="input mt-1" name="email" type="email" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="label">Pledge (₦) <span className="font-normal text-slate-400">(optional)</span><input className="input mt-1" name="pledge_amount" inputMode="decimal" placeholder="e.g. 20,000" /></label>
              <label className="label">How often<select className="input mt-1" name="frequency" defaultValue="monthly"><option value="">Not decided</option>{FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select></label>
            </div>
            <label className="checkbox"><input type="checkbox" name="send_thanks" defaultChecked /> <span>Send them the thank-you message</span></label>
            <div><SubmitButton pendingText="Adding…">Add partner</SubmitButton></div>
          </ActionForm>
        </section>

        <section className="card">
          <div className="tabs flex-wrap border-b border-slate-100 px-5 py-3">
            <Link href="/admin/partners" className={`tab ${!status ? "active" : ""}`}>Current ({current.length})</Link>
            {PARTNER_STATUSES.map((s) => <Link key={s.value} href={`/admin/partners?status=${s.value}`} className={`tab ${status === s.value ? "active" : ""}`} title={s.hint}>{s.label} ({rows.filter((r) => r.status === s.value).length})</Link>)}
            <Link href="/admin/partners?status=all" className={`tab ${status === "all" ? "active" : ""}`}>All ({rows.length})</Link>
          </div>
          <div className="table-wrap">
            <table className="data-table" data-testid="partners-table">
              <thead><tr><th>Partner</th><th>Status</th><th>Pledge</th><th>Given</th><th>Next follow-up</th><th>Assigned</th></tr></thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td><Link href={`/admin/partners/${r.id}`} className="font-semibold hover:text-blue-600">{r.person.full_name}</Link><span className="block text-xs text-slate-400">{r.person.phone}</span></td>
                    <td><StatusPill value={r.status} /><span className="block text-xs text-slate-400">{r.source === "registration" ? "At registration" : r.source === "portal" ? "From their portal" : "Added by staff"}</span></td>
                    <td>{r.pledge_amount ? <><b>{formatCurrency(r.pledge_amount)}</b><span className="block text-xs text-slate-400">{frequencyLabel(r.frequency)}</span></> : <span className="text-slate-400">—</span>}</td>
                    <td>{r.given ? <><b>{formatCurrency(r.given)}</b><span className="block text-xs text-slate-400">last {formatDate(r.last_gift_at)}</span></> : <span className="text-slate-400">Nothing yet</span>}</td>
                    <td className={isDue(r) ? "font-semibold text-red-600" : ""}>{r.next_follow_up_at ? formatDate(r.next_follow_up_at) : "—"}{isDue(r) && <span className="block text-xs">Due</span>}</td>
                    <td>{r.assignee ?? <span className="text-slate-400">Unassigned</span>}</td>
                  </tr>
                ))}
                {!shown.length && <tr><td colSpan={6} className="py-10 text-center text-slate-500">{rows.length ? "No partners with this status." : "No partners yet. When someone ticks “I'd like to become a FUJ Partner” at registration or in their portal, they appear here."}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
