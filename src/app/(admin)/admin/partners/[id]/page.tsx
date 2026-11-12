import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle, Phone, Send, UserRound } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { StatusPill } from "@/components/ui/status-pill";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { COUNTRIES, CURRENCIES, FREQUENCIES, frequencyLabel, getPartner, PARTNER_OUTCOMES, PARTNER_STATUSES, PARTNER_STREAMS, reminderDue } from "@/lib/repo/partners";
import { getSettings } from "@/lib/repo/settings";
import { logPartnerContactAction, updatePartnerAction } from "@/lib/actions/admin";
import { firstName } from "@/lib/identity-utils";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const OUTCOME_LABEL: Record<string, string> = { auto_thanks: "Automatic thank-you message", auto_reminder: "Automatic partnership reminder" };
/** A stored timestamp as YYYY-MM-DD in Lagos, for a date input. */
const dateInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 3600000).toISOString().slice(0, 10) : "");

export default async function PartnerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ added?: string }> }) {
  const admin = await requireAdmin("partners");
  const { id } = await params;
  const { added } = await searchParams;
  const partner = await getPartner(id).catch(() => null);
  if (!partner) notFound();
  const [staff, settings] = await Promise.all([db().list("admin_users", { where: { active: true } }), getSettings()]);
  const p = partner.person;
  const wa = p.normalized_phone.replace(/^\+/, "");
  const greeting = encodeURIComponent(`Hello ${firstName(p.full_name)}, this is FlagUpJesus Global Ministry. Thank you so much for choosing to partner with us! We'd love to talk with you about the partnership.`);
  const due = partner.status !== "declined" && partner.next_follow_up_at && new Date(partner.next_follow_up_at) <= new Date();
  const source = partner.source === "registration" ? "signed up at registration" : partner.source === "portal" ? "signed up from their portal" : "added by staff";
  const associate = partner.stream === "associate";
  const money = (v: number) => formatCurrency(v, partner.currency);
  return (
    <>
      <PageHeading
        title={p.full_name}
        description={<><span className={`pill ${associate ? "pill-amber" : "pill-blue"}`} data-testid="partner-stream">{associate ? "Associate partner" : "Outreach partner"}</span> {associate && (partner.country || partner.organisation) ? `${[partner.organisation, partner.country].filter(Boolean).join(" · ")} · ` : ""}since {formatDate(partner.created_at)} · {source} · <StatusPill value={partner.status} /></>}
        action={<>
          <a className="btn btn-secondary" href={`tel:${p.normalized_phone}`}><Phone size={15} /> Call</a>
          <a className="btn btn-secondary" target="_blank" rel="noreferrer" href={`https://wa.me/${wa}?text=${greeting}`}><MessageCircle size={15} /> WhatsApp</a>
          {can(admin.role, "messaging") && <Link className="btn btn-secondary" href={`/admin/messaging?to=${p.id}`}><Send size={15} /> In-app message</Link>}
          {can(admin.role, "members") && <Link className="btn btn-secondary" href={`/admin/members/${p.id}`}><UserRound size={15} /> {associate ? "Contact record" : "Member record"}</Link>}
        </>}
      />
      {added && <p className="alert alert-ok mb-5" role="status">{p.full_name} was added to the partners list.</p>}
      {due && <p className="alert alert-warn mb-5" data-testid="partner-due">A follow-up with {firstName(p.full_name)} was planned for {formatDate(partner.next_follow_up_at)}. Log the contact below when you&apos;ve spoken.</p>}

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <div className="card p-4"><p className="text-xs text-slate-500">Pledge</p><p className="text-xl font-bold">{partner.pledge_amount ? money(partner.pledge_amount) : "—"}</p><p className="text-xs text-slate-400">{frequencyLabel(partner.frequency)}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Given in total</p><p className="text-xl font-bold" data-testid="partner-given">{money(partner.given)}</p><p className="text-xs text-slate-400">{partner.gifts} gift{partner.gifts === 1 ? "" : "s"}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">This year</p><p className="text-xl font-bold">{money(partner.givenThisYear)}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Last gift</p><p className="text-xl font-bold">{formatDate(partner.last_gift_at)}</p></div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-6">
          <h2 className="font-bold">Partnership</h2>
          <ActionForm action={updatePartnerAction} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={partner.id} />
            <label className="label">Status<select className="input mt-1" name="status" defaultValue={partner.status}>{PARTNER_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label} — {s.hint}</option>)}</select></label>
            <label className="label">Assigned to<select className="input mt-1" name="assignee" defaultValue={partner.assignee ?? ""}><option value="">Unassigned</option>{staff.map((s) => <option key={s.id} value={s.full_name}>{s.full_name}</option>)}{partner.assignee && !staff.some((s) => s.full_name === partner.assignee) && <option value={partner.assignee}>{partner.assignee}</option>}</select></label>
            <label className="label">Partner type<select className="input mt-1" name="stream" defaultValue={partner.stream}>{PARTNER_STREAMS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select><span className="hint">Associates are outside FUJ and aren&apos;t on the members list</span></label>
            <label className="label">Currency<select className="input mt-1" name="currency" defaultValue={partner.currency}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label className="label">Pledge<input className="input mt-1" name="pledge_amount" inputMode="decimal" defaultValue={partner.pledge_amount ?? ""} placeholder="e.g. 20000" /></label>
            <label className="label">How often<select className="input mt-1" name="frequency" defaultValue={partner.frequency ?? ""}><option value="">Not decided</option>{FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select></label>
            <label className="label">Country<input className="input mt-1" name="country" list="partner-countries" defaultValue={partner.country ?? ""} placeholder={associate ? "e.g. United Kingdom" : "Nigeria"} /><datalist id="partner-countries">{COUNTRIES.map((c) => <option key={c} value={c} />)}</datalist></label>
            <label className="label">Church / organisation<input className="input mt-1" name="organisation" defaultValue={partner.organisation ?? ""} /></label>
            <label className="label sm:col-span-2">Next follow-up<span className="hint">When someone should reach out to them next</span><input className="input mt-1" type="date" name="next_follow_up_at" defaultValue={dateInput(partner.next_follow_up_at)} /></label>
            <label className="label sm:col-span-2">Notes (confidential)<textarea className="input mt-1" name="notes" defaultValue={partner.notes ?? ""} placeholder="What they'd like to support, preferred way to give, best time to call…" /></label>
            <div><SubmitButton>Save partner</SubmitButton></div>
          </ActionForm>
          <div className="mt-5 rounded-xl border border-slate-100 p-4 text-sm">
            <p className="font-semibold">Automatic messages</p>
            <p className="mt-1 text-slate-600">
              Thank-you: {partner.thanks_sent_at ? `sent ${formatDateTime(partner.thanks_sent_at)}` : partner.source === "admin" ? "not sent (added by staff)" : settings.partner_auto ? "goes out with the next run" : "off"}.{" "}
              Monthly reminder: {!settings.partner_reminders ? "off" : partner.last_reminder_at ? `last sent ${formatDate(partner.last_reminder_at)}` : "none yet"}
              {settings.partner_reminders && (reminderDue(partner) ? ` · due on day ${settings.partner_reminder_day}` : "")}.
            </p>
          </div>
          <h3 className="mt-6 text-sm font-semibold">Giving history</h3>
          <ul className="mt-2 divide-y divide-slate-100 text-sm" data-testid="partner-gifts">
            {partner.donations.map((d) => <li key={d.id} className="flex justify-between py-2"><span>{d.fund_name} · {formatDate(d.paid_at ?? d.created_at)}{d.status !== "paid" ? ` · ${d.status}` : ""}</span><b>{formatCurrency(d.amount, d.currency)}</b></li>)}
            {!partner.donations.length && <li className="py-2 text-slate-500">No gifts recorded yet.</li>}
          </ul>
          {can(admin.role, "giving") && <p className="mt-3 text-xs text-slate-500">Record their gifts in <Link href="/admin/giving" className="font-semibold text-blue-600">Giving</Link> with their username <b className="username-badge">{p.username}</b>{associate ? ` and the currency (${partner.currency})` : ""} — they show here and mark the partner active.</p>}
        </section>
        <section className="card p-6">
          <h2 className="font-bold">Log a contact</h2>
          <ActionForm action={logPartnerContactAction} className="mt-3 grid gap-3 sm:grid-cols-2" resetOnSuccess>
            <input type="hidden" name="id" value={partner.id} />
            <label className="label">Channel<select className="input mt-1" name="channel"><option value="call">Phone call</option><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option><option value="visit">Visit</option><option value="email">Email</option><option value="note">Note</option></select></label>
            <label className="label">Outcome<select className="input mt-1" name="outcome">{PARTNER_OUTCOMES.map((o) => <option key={o}>{o}</option>)}</select></label>
            <label className="label sm:col-span-2">Note<textarea className="input mt-1" name="note" placeholder="What did you agree?" /></label>
            <label className="label sm:col-span-2">Next follow-up <span className="font-normal text-slate-400">(optional)</span><input className="input mt-1" type="date" name="next_follow_up_at" /></label>
            <div><SubmitButton className="btn btn-secondary">Log contact</SubmitButton></div>
          </ActionForm>
          <h3 className="mt-6 text-sm font-semibold">History</h3>
          <ol className="mt-3 space-y-3 border-l-2 border-slate-100 pl-4" data-testid="partner-history">
            {partner.logs.map((l) => <li key={l.id} className="text-sm"><p><b>{OUTCOME_LABEL[l.outcome] ?? l.outcome}</b> <span className="text-slate-500">via {l.channel.replace("_", " ")}</span></p>{l.note && <p className="mt-1 text-slate-600">{l.note}</p>}<p className="mt-1 text-xs text-slate-400">{l.author} · {formatDateTime(l.created_at)}</p></li>)}
            {!partner.logs.length && <li className="text-sm text-slate-500">No contact yet — give them a call to thank them.</li>}
          </ol>
        </section>
      </div>
    </>
  );
}
