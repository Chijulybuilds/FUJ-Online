import Link from "next/link";
import { Baby, Download, MessageCircle, Phone, Send } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { listChildren, type ChildRow } from "@/lib/repo/children";
import { addChildAdminAction } from "@/lib/actions/admin";
import { AGE_GROUPS, ageLabel, childEmoji, RELATIONSHIPS } from "@/lib/children";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ChildrenPage({ searchParams }: { searchParams: Promise<{ group?: string; q?: string }> }) {
  const admin = await requireAdmin("members");
  const { group = "", q = "" } = await searchParams;
  let kids: ChildRow[];
  try {
    kids = await listChildren();
  } catch (error) {
    console.error("children unavailable", error);
    return (
      <>
        <PageHeading title="Children's church" />
        <div className="alert alert-warn" data-testid="children-db-update">The database needs a one-time update before children can be registered. In Supabase, open <b>SQL Editor → New query</b>, paste everything from <code className="mx-1">supabase/setup.sql</code>and click <b>Run</b>, then refresh this page.</div>
      </>
    );
  }
  const term = q.trim().toLowerCase();
  const aged = kids.filter((k) => k.age !== null && k.age >= 18);
  const shown = kids.filter((k) => (group === "18" ? k.age !== null && k.age >= 18 : !group || k.group?.key === group)
    && (!term || `${k.full_name} ${k.username} ${k.guardian?.full_name ?? k.guardian_name} ${k.phone}`.toLowerCase().includes(term)));
  const birthdays = kids.filter((k) => k.birthdayIn !== null && k.birthdayIn <= 30).sort((a, b) => a.birthdayIn! - b.birthdayIn!);
  const inToday = kids.filter((k) => k.inToday).length;
  const care = kids.filter((k) => k.care_notes).length;
  const families = new Set(kids.map((k) => k.guardian?.id ?? k.normalized_phone)).size;

  return (
    <>
      <PageHeading
        title="Children's church"
        description="Children registered with a parent's or guardian's phone number. They check in with their own username, or their parent checks the whole family in with one tap."
        action={<>
          {kids.length > 0 && <a href="/api/admin/export?type=children" className="btn btn-secondary"><Download size={16} /> Children (CSV)</a>}
          {can(admin.role, "messaging") && kids.length > 0 && <Link href="/admin/messaging?audience=parents" className="btn btn-secondary" data-testid="message-parents"><Send size={16} /> Message parents</Link>}
        </>}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card p-4"><p className="text-xs text-slate-500">Children</p><p className="text-2xl font-bold" data-testid="children-count">{kids.length}</p><p className="text-xs text-slate-400">from {families} famil{families === 1 ? "y" : "ies"}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">In church today</p><p className="text-2xl font-bold">{inToday}</p><p className="text-xs text-slate-400">Checked in today</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Birthdays in the next 30 days</p><p className="text-2xl font-bold">{birthdays.length}</p><p className="text-xs text-slate-400">🎂 Celebrate them in service</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Care notes</p><p className={`text-2xl font-bold ${care ? "text-red-600" : ""}`}>{care}</p><p className="text-xs text-slate-400">Allergies or special needs</p></div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {AGE_GROUPS.map((g) => {
          const n = kids.filter((k) => k.group?.key === g.key).length;
          return (
            <Link key={g.key} href={`/admin/children?group=${g.key}`} className={`card age-tile p-4 ${group === g.key ? "ring-2 ring-[var(--accent)]" : ""}`} data-testid={`group-${g.key}`}>
              <span className="text-2xl" aria-hidden>{g.emoji}</span>
              <p className="mt-1 font-bold">{g.label}</p>
              <p className="text-xs text-slate-500">Ages {g.range} · <b>{n}</b> child{n === 1 ? "" : "ren"}</p>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)]">
        <section className="card">
          <form className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
            <input className="input max-w-xs" name="q" defaultValue={q} placeholder="Search child, parent or username…" aria-label="Search children" />
            <input type="hidden" name="group" value={group} />
            <div className="tabs flex-wrap">
              <Link href="/admin/children" className={`tab ${!group ? "active" : ""}`}>All ({kids.length})</Link>
              {AGE_GROUPS.map((g) => <Link key={g.key} href={`/admin/children?group=${g.key}`} className={`tab ${group === g.key ? "active" : ""}`}>{g.label}</Link>)}
              {aged.length > 0 && <Link href="/admin/children?group=18" className={`tab ${group === "18" ? "active" : ""}`} title="Turned 18 — give them their own phone number on their record">Turned 18 ({aged.length})</Link>}
            </div>
          </form>
          <div className="table-wrap">
            <table className="data-table" data-testid="children-table">
              <thead><tr><th>Child</th><th>Age</th><th>Parent / guardian</th><th>Care notes</th><th>Attendance</th></tr></thead>
              <tbody>
                {shown.map((k) => {
                  const parentName = k.guardian?.full_name ?? k.guardian_name ?? "—";
                  const wa = k.normalized_phone.replace(/^\+/, "");
                  return (
                    <tr key={k.id}>
                      <td>
                        <Link href={`/admin/members/${k.id}`} className="flex items-center gap-2 font-semibold hover:text-blue-600"><span aria-hidden>{childEmoji(k.gender, k.age)}</span>{k.full_name}</Link>
                        <span className="username-badge block text-xs text-slate-400">{k.username}</span>
                        {k.birthdayIn === 0 && <span className="pill pill-amber mt-1">🎉 Birthday today!</span>}
                      </td>
                      <td>{ageLabel(k.birthday)}<span className="block text-xs text-slate-400">{k.group ? `${k.group.emoji} ${k.group.label}` : k.age !== null && k.age >= 18 ? "Turned 18" : "—"}</span></td>
                      <td>
                        {k.guardian ? <Link href={`/admin/members/${k.guardian.id}`} className="font-semibold hover:text-blue-600">{parentName}</Link> : <span className="font-semibold">{parentName}</span>}
                        <span className="block text-xs text-slate-400">{k.guardian_relationship ?? "Parent / guardian"}{!k.guardian && " · not registered"}</span>
                        <span className="mt-1 flex gap-1">
                          <a className="btn btn-ghost btn-sm" href={`tel:${k.normalized_phone}`} aria-label={`Call ${parentName}`}><Phone size={13} /> {k.phone}</a>
                          <a className="btn btn-ghost btn-sm" target="_blank" rel="noreferrer" href={`https://wa.me/${wa}`} aria-label={`WhatsApp ${parentName}`}><MessageCircle size={13} /></a>
                        </span>
                      </td>
                      <td className="max-w-[16rem]">{k.care_notes ? <span className="care-note" title={k.care_notes}>⚠️ {k.care_notes}</span> : <span className="text-slate-400">—</span>}</td>
                      <td>{k.visits ? `${k.visits} time${k.visits === 1 ? "" : "s"}` : "Not yet"}<span className="block text-xs text-slate-400">{k.inToday ? "✓ In church today" : k.lastSeen ? `last ${formatDate(k.lastSeen)}` : ""}</span></td>
                    </tr>
                  );
                })}
                {!shown.length && (
                  <tr><td colSpan={5} className="py-10 text-center text-slate-500">
                    <Baby className="mx-auto mb-2 text-[var(--accent)]" size={24} />
                    {kids.length ? "No children match." : "No children registered yet. Parents can register children on the sign-up page (“My child”) or in their portal, and ushers at the check-in desk."}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-6">
          <section className="card p-6" data-testid="children-birthdays">
            <h2 className="font-bold">🎂 Coming birthdays</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {birthdays.slice(0, 8).map((k) => (
                <li key={k.id} className="flex items-center justify-between gap-3">
                  <Link href={`/admin/members/${k.id}`} className="hover:text-blue-600">{childEmoji(k.gender, k.age)} {k.full_name}</Link>
                  <span className="whitespace-nowrap text-slate-500">{k.birthdayIn === 0 ? <b className="text-[var(--accent)]">Today! 🎉</b> : `in ${k.birthdayIn} day${k.birthdayIn === 1 ? "" : "s"}`} · turns {k.turning}</span>
                </li>
              ))}
              {!birthdays.length && <li className="text-slate-500">No birthdays in the next 30 days.</li>}
            </ul>
          </section>
          <section className="card p-6">
            <h2 className="font-bold">Register a child</h2>
            <p className="mt-1 text-xs text-slate-500">With the parent&apos;s or guardian&apos;s phone number. If the parent is registered with it, the child is linked to them.</p>
            <ActionForm action={addChildAdminAction} className="mt-4 grid gap-3">
              <label className="label">Child&apos;s full name<input className="input mt-1" name="full_name" required /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="label">Birthday<input className="input mt-1" name="birthday" type="date" required /></label>
                <label className="label">Boy / girl<select className="input mt-1" name="gender" defaultValue=""><option value="">—</option><option value="male">Boy</option><option value="female">Girl</option></select></label>
              </div>
              <label className="label">Parent&apos;s phone number<input className="input mt-1" name="phone" required inputMode="tel" placeholder="0803 000 0000" /></label>
              <label className="label">Parent / guardian&apos;s name<span className="hint">Needed if they aren&apos;t registered themselves</span><input className="input mt-1" name="guardian_name" /></label>
              <label className="label">Relationship<select className="input mt-1" name="relationship" defaultValue="">{[["", "—"], ...RELATIONSHIPS.map((r) => [r, r])].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
              <label className="label">Care notes <span className="font-normal text-slate-400">(optional)</span><textarea className="input mt-1" name="care_notes" maxLength={500} placeholder="Allergies, medical needs, pick-up…" /></label>
              <SubmitButton pendingText="Registering…">Register child</SubmitButton>
            </ActionForm>
          </section>
        </div>
      </div>
    </>
  );
}
