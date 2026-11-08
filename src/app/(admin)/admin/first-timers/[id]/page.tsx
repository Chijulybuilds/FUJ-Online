import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle, Phone, Send, UserRound } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { StatusPill } from "@/components/ui/status-pill";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { FIRST_TIMER_OUTCOMES, getFirstTimer, STAGES } from "@/lib/repo/first-timers";
import { getSettings } from "@/lib/repo/settings";
import { logFirstTimerContactAction, updateFirstTimerAction } from "@/lib/actions/admin";
import { firstName } from "@/lib/identity-utils";
import { childrenOf } from "@/lib/repo/people";
import { ageOf } from "@/lib/children";
import { formatDate, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const OUTCOME_LABEL: Record<string, string> = { auto_welcome: "Automatic welcome message", auto_invite: "Automatic Sunday invitation" };
const STEPS = [["new", "First visit", "first_visit_at"], ["welcomed", "Welcomed", "welcomed_at"], ["returned", "Came back", "returned_at"], ["settled", "Settled in", "settled_at"]] as const;

export default async function FirstTimerPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin("care");
  const { id } = await params;
  const ft = await getFirstTimer(id).catch(() => null);
  if (!ft) notFound();
  const [staff, settings, kids] = await Promise.all([db().list("admin_users", { where: { active: true } }), getSettings(), childrenOf(ft.person).catch(() => [])]);
  const p = ft.person;
  const wa = p.normalized_phone.replace(/^\+/, "");
  const greeting = encodeURIComponent(`Hello ${firstName(p.full_name)}, this is FlagUpJesus Global Ministry. Thank you so much for worshipping with us! How did you enjoy the service? We'd love to see you again this Sunday.`);
  const reached = (k: (typeof STEPS)[number][2]) => Boolean(ft[k]);
  const stageIndex = STEPS.findIndex(([s]) => s === ft.stage);
  return (
    <>
      <PageHeading
        title={p.full_name}
        description={<>First visit {formatDate(ft.first_visit_at)}{ft.service ? ` · ${ft.service.title}` : ""} · <StatusPill value={ft.stage} /></>}
        action={<>
          <a className="btn btn-secondary" href={`tel:${p.normalized_phone}`}><Phone size={15} /> Call</a>
          <a className="btn btn-secondary" target="_blank" rel="noreferrer" href={`https://wa.me/${wa}?text=${greeting}`}><MessageCircle size={15} /> WhatsApp</a>
          {can(admin.role, "messaging") && <Link className="btn btn-secondary" href={`/admin/messaging?to=${p.id}`}><Send size={15} /> In-app message</Link>}
          {can(admin.role, "members") && <Link className="btn btn-secondary" href={`/admin/members/${p.id}`}><UserRound size={15} /> Member record</Link>}
        </>}
      />

      <ol className="journey card mb-6 p-5" data-testid="journey">
        {STEPS.map(([value, label, stamp], i) => {
          const done = value === "new" || reached(stamp) || (ft.stage !== "closed" && i <= stageIndex);
          const when = value === "new" ? ft.first_visit_at : ft[stamp];
          return (
            <li key={value} className={`journey-step ${done ? "done" : ""} ${ft.stage === value ? "current" : ""}`}>
              <span className="journey-dot">{i + 1}</span>
              <span><b>{label}</b><small>{when ? formatDate(when) : "—"}</small></span>
            </li>
          );
        })}
        {ft.stage === "closed" && <li className="journey-step closed"><span className="journey-dot">✕</span><span><b>Closed</b><small>{ft.close_reason ?? formatDate(ft.closed_at)}</small></span></li>}
      </ol>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-6">
          <h2 className="font-bold">Follow-up</h2>
          <dl className="kv mt-3">
            <dt>Phone</dt><dd>{p.phone}</dd>
            <dt>Email</dt><dd>{p.email ?? "—"}</dd>
            <dt>Address</dt><dd>{p.address ?? "—"}</dd>
            <dt>Birthday</dt><dd>{p.birthday ? formatDate(p.birthday, { day: "numeric", month: "long" }) : "—"}</dd>
            <dt>Username</dt><dd className="username-badge">{p.username}</dd>
            <dt>Services attended</dt><dd>{ft.visits}</dd>
            {kids.length > 0 && <><dt>Children</dt><dd>{kids.map((k) => `${k.full_name.split(" ")[0]}${ageOf(k.birthday) !== null ? ` (${ageOf(k.birthday)})` : ""}`).join(", ")}</dd></>}
          </dl>
          <div className="mt-5 rounded-xl border border-slate-100 p-4 text-sm" data-testid="first-timer-auto">
            <p className="font-semibold">Automatic messages</p>
            <p className="mt-1 text-slate-600">
              Welcome message: {ft.welcome_sent_at ? `sent ${formatDateTime(ft.welcome_sent_at)}` : settings.first_timer_auto ? "goes out with the next run" : "off"}.{" "}
              Sunday invitations: {ft.invites_sent} of {settings.first_timer_max_invites} sent{ft.last_invite_at ? ` (last ${formatDate(ft.last_invite_at)})` : ""}.
              {(ft.stage === "returned" || ft.stage === "settled") && " Stopped — they came back. 🙌"}
              {ft.stage === "closed" && " Stopped — closed."}
            </p>
          </div>
          <ActionForm action={updateFirstTimerAction} className="mt-5 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={ft.id} />
            <label className="label">Stage<select className="input mt-1" name="stage" defaultValue={ft.stage}>{STAGES.map((s) => <option key={s.value} value={s.value} title={s.hint}>{s.label}</option>)}</select></label>
            <label className="label">Assigned to<select className="input mt-1" name="assignee" defaultValue={ft.assignee ?? ""}><option value="">Unassigned</option>{staff.map((s) => <option key={s.id} value={s.full_name}>{s.full_name}</option>)}{ft.assignee && !staff.some((s) => s.full_name === ft.assignee) && <option value={ft.assignee}>{ft.assignee}</option>}</select></label>
            <label className="label sm:col-span-2">If closing — why?<span className="hint">e.g. moved away, visiting from another church, not reachable</span><input className="input mt-1" name="close_reason" defaultValue={ft.close_reason ?? ""} maxLength={200} /></label>
            <label className="label sm:col-span-2">Notes (confidential)<textarea className="input mt-1" name="notes" defaultValue={ft.notes ?? ""} placeholder="How they heard about us, family, prayer needs, which unit they're interested in…" /></label>
            <div><SubmitButton>Save</SubmitButton></div>
          </ActionForm>
          <h3 className="mt-6 text-sm font-semibold">Services attended</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {ft.attendance.map((a) => <li key={a.id} className="flex justify-between gap-3 border-b border-slate-100 pb-2"><span>{a.service?.title ?? "Service"}</span><span className="text-slate-500">{formatDateTime(a.checked_in_at)}</span></li>)}
            {!ft.attendance.length && <li className="text-slate-500">No check-ins yet (registered online).</li>}
          </ul>
        </section>
        <section className="card p-6">
          <h2 className="font-bold">Log a contact</h2>
          <p className="mt-1 text-xs text-slate-500">Logging “Reached …” moves a new first timer to <b>Welcomed</b>; “joined a unit / TFT” marks them <b>Settled in</b>.</p>
          <ActionForm action={logFirstTimerContactAction} className="mt-3 grid gap-3 sm:grid-cols-2" resetOnSuccess>
            <input type="hidden" name="id" value={ft.id} />
            <label className="label">Channel<select className="input mt-1" name="channel"><option value="call">Phone call</option><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option><option value="visit">Visit</option><option value="email">Email</option><option value="note">Note</option></select></label>
            <label className="label">Outcome<select className="input mt-1" name="outcome">{FIRST_TIMER_OUTCOMES.map((o) => <option key={o}>{o}</option>)}</select></label>
            <label className="label sm:col-span-2">Note<textarea className="input mt-1" name="note" placeholder="What did you talk about?" /></label>
            <div><SubmitButton className="btn btn-secondary">Log contact</SubmitButton></div>
          </ActionForm>
          <h3 className="mt-6 text-sm font-semibold">History</h3>
          <ol className="mt-3 space-y-3 border-l-2 border-slate-100 pl-4" data-testid="first-timer-history">
            {ft.logs.map((l) => <li key={l.id} className="text-sm"><p><b>{OUTCOME_LABEL[l.outcome] ?? l.outcome}</b> <span className="text-slate-500">via {l.channel.replace("_", " ")}</span></p>{l.note && <p className="mt-1 text-slate-600">{l.note}</p>}<p className="mt-1 text-xs text-slate-400">{l.author} · {formatDateTime(l.created_at)}</p></li>)}
            {!ft.logs.length && <li className="text-sm text-slate-500">Nothing yet — give them a call to welcome them.</li>}
          </ol>
        </section>
      </div>
    </>
  );
}
