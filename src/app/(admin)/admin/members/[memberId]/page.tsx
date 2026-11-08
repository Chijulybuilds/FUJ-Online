import Link from "next/link";
import { notFound } from "next/navigation";
import { Phone, MessageCircle } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { StatusPill } from "@/components/ui/status-pill";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { CopyButton } from "@/components/shared/copy-button";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { attendanceForPerson } from "@/lib/repo/services";
import { addPartnerAction, createTaskAction, sendWelcomeToPersonAction, startFirstTimerAction, updatePersonAction } from "@/lib/actions/admin";
import { credentialFor } from "@/lib/repo/accounts";
import { FREQUENCIES, frequencyLabel } from "@/lib/repo/partners";
import { childrenOf } from "@/lib/repo/people";
import { ageGroupOf, ageLabel, ageOf, childEmoji, nextBirthday, RELATIONSHIPS } from "@/lib/children";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

export default async function MemberDetails({ params, searchParams }: { params: Promise<{ memberId: string }>; searchParams: Promise<{ created?: string }> }) {
  const admin = await requireAdmin("members");
  const { memberId } = await params;
  const { created } = await searchParams;
  const person = await db().get("people", { id: memberId }).catch(() => null);
  if (!person) notFound();
  const [attendance, tasks, prayers, journey, partner] = await Promise.all([
    attendanceForPerson(person.id),
    db().list("follow_up_tasks", { where: { person_id: person.id }, order: { column: "created_at", ascending: false } }),
    can(admin.role, "prayer") ? db().list("prayer_requests", { where: { person_id: person.id } }) : Promise.resolve([]),
    can(admin.role, "care") ? db().get("first_timers", { person_id: person.id }).catch(() => null) : Promise.resolve(null),
    can(admin.role, "partners") ? db().get("partners", { person_id: person.id }).catch(() => null) : Promise.resolve(null)
  ]);
  const [kids, guardian] = await Promise.all([
    person.is_child ? Promise.resolve([]) : childrenOf(person).catch(() => []),
    person.is_child && person.guardian_id ? db().get("people", { id: person.guardian_id }).catch(() => null) : Promise.resolve(null)
  ]);
  const credential = await credentialFor(person.id);
  const age = ageOf(person.birthday);
  const group = ageGroupOf(age);
  const bday = nextBirthday(person.birthday);
  const wa = person.normalized_phone.replace(/^\+/, "");
  return (
    <>
      <PageHeading title={person.full_name} description={<>{person.person_code} · <StatusPill value={person.status} />{person.is_child && <span className="pill pill-amber ml-1">child</span>}</>}
        action={<><a className="btn btn-secondary" href={`tel:${person.normalized_phone}`}><Phone size={15} /> {person.is_child ? "Call parent" : "Call"}</a><a className="btn btn-secondary" target="_blank" rel="noreferrer" href={`https://wa.me/${wa}`}><MessageCircle size={15} /> {person.is_child ? "WhatsApp parent" : "WhatsApp"}</a></>} />
      {person.is_child && (
        <section className="card mb-6 flex flex-wrap items-center gap-5 p-5" data-testid="child-summary">
          <span className="kid-avatar" aria-hidden>{childEmoji(person.gender, age)}</span>
          <div className="min-w-0 flex-1">
            <p className="font-bold">{ageLabel(person.birthday)}{group && ` · ${group.emoji} ${group.label}`}{age !== null && age >= 18 && " · turned 18 — give them their own phone number to move them to the adult register"}</p>
            <p className="text-sm text-slate-500">
              Parent / guardian: {guardian ? <Link className="font-semibold text-blue-600" href={`/admin/members/${guardian.id}`}>{guardian.full_name}</Link> : <b>{person.guardian_name ?? "—"}</b>}
              {person.guardian_relationship ? ` (${person.guardian_relationship.toLowerCase()})` : ""} · {person.phone}{!guardian && " · parent not registered yet"}
            </p>
            {bday && <p className="text-sm">{bday.days === 0 ? "🎉 Birthday today!" : `🎂 Birthday in ${bday.days} day${bday.days === 1 ? "" : "s"} — turning ${bday.turning}`}</p>}
          </div>
          {person.care_notes && <p className="care-note max-w-sm" data-testid="child-care-notes">⚠️ {person.care_notes}</p>}
        </section>
      )}
      {created && <p className="alert alert-ok mb-5">Record created. Their check-in username is <b className="username-badge">{person.username}</b> — share it with them.</p>}
      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <section className="card p-6">
          <div className="mb-5 flex items-center justify-between rounded-xl bg-blue-50 p-4">
            <div><p className="text-xs text-slate-500">Check-in username</p><p className="username-badge text-xl font-bold text-blue-700" data-testid="member-username">{person.username}</p></div>
            <CopyButton value={person.username ?? ""} />
          </div>
          <ActionForm action={updatePersonAction} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={person.id} />
            <label className="label sm:col-span-2">Full name<input className="input mt-1" name="full_name" defaultValue={person.full_name} required /></label>
            <label className="label">{person.is_child ? "Parent's phone" : "Phone"}<input className="input mt-1" name="phone" defaultValue={person.phone} required /></label>
            <label className="label">Email<input className="input mt-1" name="email" type="email" defaultValue={person.email ?? ""} /></label>
            <label className="label">Status<select className="input mt-1" name="status" defaultValue={person.status}>{["member", "inactive", "transferred", "left_ministry"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select></label>
            <label className="label">Gender<select className="input mt-1" name="gender" defaultValue={person.gender ?? ""}><option value="">—</option><option value="female">Female</option><option value="male">Male</option></select></label>
            <label className="label">Birthday<input className="input mt-1" type="date" name="birthday" defaultValue={person.birthday ?? ""} /></label>
            <label className="label">On WhatsApp?<span className="hint">Learned automatically from delivery receipts</span><select className="input mt-1" name="whatsapp" defaultValue={person.whatsapp ?? "unknown"}><option value="unknown">Unknown — try WhatsApp first</option><option value="yes">Yes — WhatsApp</option><option value="no">No — send SMS</option></select></label>
            <label className="label">Address<input className="input mt-1" name="address" defaultValue={person.address ?? ""} /></label>
            {person.is_child && <>
              <label className="label">Parent / guardian&apos;s name<input className="input mt-1" name="guardian_name" defaultValue={person.guardian_name ?? ""} /></label>
              <label className="label">Relationship<select className="input mt-1" name="guardian_relationship" defaultValue={person.guardian_relationship ?? ""}><option value="">—</option>{RELATIONSHIPS.map((r) => <option key={r}>{r}</option>)}</select></label>
              <label className="label sm:col-span-2">Care notes<span className="hint">Allergies, medical needs, who may pick them up (children&apos;s church team only)</span><textarea className="input mt-1" name="care_notes" defaultValue={person.care_notes ?? ""} maxLength={500} /></label>
            </>}
            <label className="label sm:col-span-2">Notes<textarea className="input mt-1" name="notes" defaultValue={person.notes ?? ""} /></label>
            <dl className="kv sm:col-span-2 mt-2"><dt>First visit</dt><dd>{formatDate(person.first_visit_at)}</dd><dt>Joined</dt><dd>{formatDate(person.joined_at)}</dd><dt>Heard via</dt><dd>{person.how_heard ?? "—"}</dd><dt>Sign-in</dt><dd>{person.auth_subject?.startsWith("google:") ? "Google linked" : "Username + phone"}</dd></dl>
            <div className="sm:col-span-2"><SubmitButton>Save changes</SubmitButton></div>
          </ActionForm>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-4 text-sm" data-testid="welcome-status">
            <span>✉️ Welcome email: {person.welcome_email_sent_at ? <b>sent {formatDateTime(person.welcome_email_sent_at)}</b> : person.email ? <b>not sent yet</b> : <span className="text-slate-500">no email address</span>}<span className="block text-xs text-slate-500">Password: {credential ? "set" : "not set (signs in with phone number)"}</span></span>
            {person.email && <ActionForm action={sendWelcomeToPersonAction}><input type="hidden" name="id" value={person.id} /><SubmitButton className="btn btn-secondary btn-sm" pendingText="Sending…">{person.welcome_email_sent_at ? "Send again" : "Send welcome email"}</SubmitButton></ActionForm>}
          </div>
        </section>
        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="font-bold">Attendance <span className="text-sm font-normal text-slate-500">({attendance.length} services)</span></h2>
            <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm">
              {attendance.map((a) => <li key={a.id} className="flex justify-between gap-3 border-b border-slate-100 pb-2"><span>{a.service?.title ?? "Service"}</span><span className="text-slate-500">{formatDateTime(a.checked_in_at)} · {a.check_in_method}</span></li>)}
              {!attendance.length && <li className="text-slate-500">No attendance recorded yet.</li>}
            </ul>
          </section>
          {!person.is_child && (kids.length > 0 || person.address) && (
            <section className="card p-6" data-testid="member-children">
              <div className="flex items-center justify-between gap-3"><h2 className="font-bold">Children <span className="text-sm font-normal text-slate-500">({kids.length})</span></h2><Link href="/admin/children" className="text-xs font-semibold text-blue-600">Children&apos;s church →</Link></div>
              <ul className="mt-3 space-y-2 text-sm">
                {kids.map((k) => <li key={k.id}><Link href={`/admin/members/${k.id}`} className="flex items-center justify-between gap-3 hover:text-blue-600"><span>{childEmoji(k.gender, ageOf(k.birthday))} {k.full_name}</span><span className="text-slate-500">{ageLabel(k.birthday)} · <span className="username-badge">{k.username}</span></span></Link></li>)}
                {!kids.length && <li className="text-slate-500">No children registered with {person.full_name.split(" ")[0]}&apos;s number.</li>}
              </ul>
            </section>
          )}
          {!person.is_child && (can(admin.role, "care") || can(admin.role, "partners")) && (
            <section className="card p-6" data-testid="member-journeys">
              <h2 className="font-bold">First timer &amp; partnership</h2>
              {can(admin.role, "care") && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-4 text-sm">
                  {journey
                    ? <><span>✨ <b>First timer</b> since {formatDate(journey.first_visit_at)} · <StatusPill value={journey.stage} /></span><Link className="btn btn-secondary btn-sm" href={`/admin/first-timers/${journey.id}`}>Open follow-up</Link></>
                    : <>
                        <span>{person.first_timer === false ? "Told us at registration they've been coming to FlagUpJesus before." : "Not on the first-timer follow-up."}</span>
                        <ActionForm action={startFirstTimerAction}><input type="hidden" name="person_id" value={person.id} /><SubmitButton className="btn btn-secondary btn-sm" pendingText="Starting…">Start first-timer follow-up</SubmitButton></ActionForm>
                      </>}
                </div>
              )}
              {can(admin.role, "partners") && (
                <div className="mt-3 rounded-xl border border-slate-100 p-4 text-sm">
                  {partner
                    ? <div className="flex flex-wrap items-center justify-between gap-3"><span>💛 <b>FUJ Partner</b> · <StatusPill value={partner.status} />{partner.pledge_amount ? ` · ${formatCurrency(Number(partner.pledge_amount))} ${frequencyLabel(partner.frequency).toLowerCase()}` : ""}</span><Link className="btn btn-secondary btn-sm" href={`/admin/partners/${partner.id}`}>Open partner</Link></div>
                    : <ActionForm action={addPartnerAction} className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="person_id" value={person.id} />
                        <span className="w-full text-slate-600">Not a partner yet.</span>
                        <label className="label flex-1">Pledge (₦) <span className="font-normal text-slate-400">(optional)</span><input className="input mt-1" name="pledge_amount" inputMode="decimal" /></label>
                        <label className="label">How often<select className="input mt-1" name="frequency" defaultValue="monthly"><option value="">Not decided</option>{FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select></label>
                        <SubmitButton className="btn btn-secondary" pendingText="Adding…">Add as partner</SubmitButton>
                      </ActionForm>}
                </div>
              )}
            </section>
          )}
          {can(admin.role, "care") && (
            <section className="card p-6">
              <h2 className="font-bold">Pastoral follow-ups</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {tasks.map((t) => <li key={t.id}><Link href={`/admin/pastoral-care/${t.id}`} className="flex justify-between gap-3 hover:text-blue-600"><span>{t.reason}</span><StatusPill value={t.status} /></Link></li>)}
                {!tasks.length && <li className="text-slate-500">No follow-ups.</li>}
              </ul>
              <ActionForm action={createTaskAction} className="mt-4 flex flex-wrap gap-2" resetOnSuccess>
                <input type="hidden" name="person_id" value={person.id} />
                <input className="input flex-1" name="reason" placeholder="Reason for follow-up" required />
                <select className="input w-32" name="priority"><option value="normal">Normal</option><option value="high">High</option><option value="low">Low</option></select>
                <SubmitButton className="btn btn-secondary">Add task</SubmitButton>
              </ActionForm>
            </section>
          )}
          {prayers.length > 0 && (
            <section className="card p-6"><h2 className="font-bold">Prayer requests</h2><ul className="mt-3 space-y-2 text-sm">{prayers.map((p) => <li key={p.id} className="flex justify-between gap-3"><span>{p.request_text}</span><StatusPill value={p.status} /></li>)}</ul></section>
          )}
        </div>
      </div>
    </>
  );
}
