import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, MessageCircle, Phone, PhoneOff, Send, Sparkles, UserRound, X } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { getFirstTimer, historyLabel, SIMPLE_STATUSES, simpleStatus } from "@/lib/repo/first-timers";
import { getSettings } from "@/lib/repo/settings";
import { firstTimerStepAction, saveFirstTimerNotesAction } from "@/lib/actions/admin";
import { firstName } from "@/lib/identity-utils";
import { childrenOf } from "@/lib/repo/people";
import { ageOf } from "@/lib/children";
import { formatDate, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TONE = { to_call: "pill-amber", called: "pill-blue", came_back: "pill-green", removed: "pill-gray" } as const;

export default async function FirstTimerPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin("first_timers");
  const { id } = await params;
  const ft = await getFirstTimer(id).catch(() => null);
  if (!ft) notFound();
  const [settings, kids] = await Promise.all([getSettings(), childrenOf(ft.person).catch(() => [])]);
  const p = ft.person;
  const status = simpleStatus(ft.stage);
  const info = SIMPLE_STATUSES.find((s) => s.value === status)!;
  const wa = p.normalized_phone.replace(/^\+/, "");
  const greeting = encodeURIComponent(`Hello ${firstName(p.full_name)}, this is FlagUpJesus Global Ministry. Thank you so much for worshipping with us! How did you enjoy the service? We'd love to see you again this Sunday.`);
  const auto = !settings.first_timer_auto ? "Automatic messages are off."
    : status === "came_back" ? "Automatic invitations stopped — they came back. 🙌"
    : status === "removed" ? "No more automatic messages."
    : `Welcome message ${ft.welcome_sent_at ? `sent ${formatDate(ft.welcome_sent_at)}` : "goes out shortly"} · Sunday invitations: ${ft.invites_sent} of ${settings.first_timer_max_invites} sent.`;
  return (
    <>
      <PageHeading
        title={p.full_name}
        description={<>First came {formatDate(ft.first_visit_at)}{ft.service ? ` · ${ft.service.title}` : ""} · <span className={`pill ${TONE[status]}`} data-testid="first-timer-status">{info.label}</span></>}
        action={<>
          <a className="btn btn-secondary" href={`tel:${p.normalized_phone}`}><Phone size={15} /> Call</a>
          <a className="btn btn-secondary" target="_blank" rel="noreferrer" href={`https://wa.me/${wa}?text=${greeting}`}><MessageCircle size={15} /> WhatsApp</a>
          {can(admin.role, "messaging") && <Link className="btn btn-secondary" href={`/admin/messaging?to=${p.id}`}><Send size={15} /> In-app message</Link>}
          {can(admin.role, "members") && <Link className="btn btn-secondary" href={`/admin/members/${p.id}`}><UserRound size={15} /> Member record</Link>}
        </>}
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <section className="card p-6" data-testid="first-timer-step">
            <h2 className="font-bold">What happened?</h2>
            <p className="mt-1 text-sm text-slate-500">{info.hint}</p>
            <ActionForm action={firstTimerStepAction} className="mt-4 grid gap-3">
              <input type="hidden" name="id" value={ft.id} />
              <label className="label">Note <span className="font-normal text-slate-400">(optional)</span><textarea className="input mt-1 min-h-20" name="note" placeholder="e.g. Lovely chat — she enjoyed the worship and will bring her sister." /></label>
              <div className="flex flex-wrap gap-2">
                {status !== "removed" && <SubmitButton name="do" value="reached" pendingText="Saving…"><Check size={15} /> Reached them</SubmitButton>}
                {status !== "removed" && <SubmitButton name="do" value="no_answer" className="btn btn-secondary" pendingText="Saving…"><PhoneOff size={15} /> No answer</SubmitButton>}
                {(status === "to_call" || status === "called") && <SubmitButton name="do" value="came_back" className="btn btn-secondary" pendingText="Saving…"><Sparkles size={15} /> Came back</SubmitButton>}
                {status !== "removed"
                  ? <SubmitButton name="do" value="remove" className="btn btn-secondary" pendingText="Saving…"><X size={15} /> Remove from list</SubmitButton>
                  : <SubmitButton name="do" value="restore" className="btn btn-secondary" pendingText="Saving…">Put back on the list</SubmitButton>}
              </div>
            </ActionForm>
            <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500" data-testid="first-timer-auto">{auto}</p>
          </section>

          <section className="card p-6">
            <h2 className="font-bold">History</h2>
            <ol className="mt-3 space-y-3 border-l-2 border-slate-100 pl-4" data-testid="first-timer-history">
              {ft.logs.map((l) => (
                <li key={l.id} className="text-sm">
                  <p><b>{historyLabel(l.outcome)}</b></p>
                  {l.note && <p className="mt-1 text-slate-600">{l.note}</p>}
                  <p className="mt-1 text-xs text-slate-400">{l.author} · {formatDateTime(l.created_at)}</p>
                </li>
              ))}
              {!ft.logs.length && <li className="text-sm text-slate-500">Nothing yet — give them a call to say welcome.</li>}
            </ol>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="font-bold">About {firstName(p.full_name)}</h2>
            <dl className="kv mt-3">
              <dt>Phone</dt><dd>{p.phone}</dd>
              <dt>Email</dt><dd>{p.email ?? "—"}</dd>
              <dt>Address</dt><dd>{p.address ?? "—"}</dd>
              <dt>Birthday</dt><dd>{p.birthday ? formatDate(p.birthday, { day: "numeric", month: "long" }) : "—"}</dd>
              <dt>Username</dt><dd className="username-badge">{p.username}</dd>
              <dt>Times in church</dt><dd>{ft.visits}</dd>
              {kids.length > 0 && <><dt>Children</dt><dd>{kids.map((k) => `${k.full_name.split(" ")[0]}${ageOf(k.birthday) !== null ? ` (${ageOf(k.birthday)})` : ""}`).join(", ")}</dd></>}
            </dl>
          </section>
          <section className="card p-6">
            <h2 className="font-bold">Notes</h2>
            <ActionForm action={saveFirstTimerNotesAction} className="mt-3 grid gap-3">
              <input type="hidden" name="id" value={ft.id} />
              <textarea className="input min-h-28" name="notes" aria-label="Notes" defaultValue={ft.notes ?? ""} placeholder="How they heard about us, family, prayer needs, which unit they'd like to join…" />
              <div><SubmitButton className="btn btn-secondary">Save notes</SubmitButton></div>
            </ActionForm>
          </section>
        </div>
      </div>
    </>
  );
}
