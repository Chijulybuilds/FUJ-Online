import Link from "next/link";
import { Baby, Download, MessageCircle, Phone, Send } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { listChildren, type ChildRow } from "@/lib/repo/children";
import { AGE_GROUPS, ageLabel, childEmoji } from "@/lib/children";
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
        <PageHeading title="Children & teens" />
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
  const onParentsPhone = kids.filter((k) => !k.ownPhone).length;

  return (
    <>
      <PageHeading
        title="Children & teens"
        description="Everyone under 18 — registered with their own phone number or a parent's / guardian's. Those on a parent's number check in with their own username, or the parent checks the whole family in with one tap."
        action={<>
          {kids.length > 0 && <a href="/api/admin/export?type=children" className="btn btn-secondary"><Download size={16} /> Children (CSV)</a>}
          {can(admin.role, "messaging") && kids.length > 0 && <Link href="/admin/messaging?audience=parents" className="btn btn-secondary" data-testid="message-parents"><Send size={16} /> Message parents</Link>}
        </>}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card p-4"><p className="text-xs text-slate-500">Children</p><p className="text-2xl font-bold" data-testid="children-count">{kids.length}</p><p className="text-xs text-slate-400">{onParentsPhone} on a parent&apos;s phone</p></div>
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
              <thead><tr><th>Name</th><th>Age</th><th>Phone</th><th>Care notes</th><th>Attendance</th></tr></thead>
              <tbody>
                {shown.map((k) => {
                  const parentName = k.ownPhone ? k.full_name : k.guardian?.full_name ?? k.guardian_name ?? "—";
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
                        {k.ownPhone ? <span className="font-semibold">Own phone</span> : k.guardian ? <Link href={`/admin/members/${k.guardian.id}`} className="font-semibold hover:text-blue-600">{parentName}</Link> : <span className="font-semibold">{parentName}</span>}
                        {!k.ownPhone && <span className="block text-xs text-slate-400">{k.guardian_relationship ?? "Parent / guardian"}&apos;s phone{!k.guardian && " · parent not registered"}</span>}
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
                    {kids.length ? "No one matches." : "No under-18s registered yet. They register on the “I'm new” page — with their own phone or a parent's — or ushers add them at the check-in desk."}
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
          <section className="card p-6" data-testid="under-18-how">
            <h2 className="font-bold">How under-18s register</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600">
              <li>On the <b>I&apos;m new</b> page they enter their details and birthday.</li>
              <li>If they&apos;re under 18, they choose <b>My own phone</b> or <b>My parent&apos;s or guardian&apos;s</b> (with the parent&apos;s name), and confirm their parent knows.</li>
              <li>On a parent&apos;s number they get their own username, are linked to the parent if registered, and messages go to the parent&apos;s phone.</li>
            </ol>
            <p className="mt-3 text-xs text-slate-500">No phone at all? Ushers can add them at the <Link href="/admin/attendance/desk" className="font-semibold text-blue-600">Check-in desk</Link>.</p>
          </section>
        </div>
      </div>
    </>
  );
}
