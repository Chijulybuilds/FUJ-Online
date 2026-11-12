import Link from "next/link";
import { Download, Upload, UserPlus } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { StatusPill } from "@/components/ui/status-pill";
import { requireAdmin } from "@/lib/auth/session";
import { listPeople } from "@/lib/repo/people";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { ageOf } from "@/lib/children";

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  await requireAdmin("members");
  const { q = "", status = "" } = await searchParams;
  const [all, attendance, leaders] = await Promise.all([listPeople(), db().list("attendance"), db().list("leaders").catch(() => [])]);
  // Associate partners (outside FlagUpJesus) live under Partners, not here.
  const people = all.filter((p) => p.status !== "associate");
  const leaderUnit = new Map(leaders.map((l) => [l.person_id, l.unit]));
  const lastSeen = new Map<string, string>();
  attendance.forEach((a) => { if ((lastSeen.get(a.person_id) ?? "") < a.checked_in_at) lastSeen.set(a.person_id, a.checked_in_at); });
  const term = q.toLowerCase();
  const filtered = people.filter((p) => (!status || (status === "leaders" ? leaderUnit.has(p.id) : status === "children" ? p.is_child : status === "inactive" ? p.status !== "member" : p.status === status)) && (!term || `${p.full_name} ${p.phone} ${p.normalized_phone} ${p.username} ${p.person_code} ${p.email}`.toLowerCase().includes(term)));
  const kids = people.filter((p) => p.is_child).length;
  const tabs = [["", "All"], ["member", "Active"], ["leaders", `Leaders (${leaderUnit.size})`], ["children", `Children (${kids})`], ["inactive", "Inactive / moved"]];
  return (
    <>
      <PageHeading title="Members" description={`${people.length} member${people.length === 1 ? "" : "s"} · everyone who registers is a member and gets a unique flag username.`}
        action={<><a href="/api/admin/export?type=people" className="btn btn-secondary"><Download size={16} /> Export CSV</a><a href="/api/admin/export?type=vcf" className="btn btn-secondary" title="Import into the church phone to build WhatsApp broadcast lists"><Download size={16} /> Contacts for WhatsApp (.vcf)</a><Link href="/admin/members/import" className="btn btn-secondary" data-testid="import-link"><Upload size={16} /> Import contacts</Link><Link href="/admin/members/new" className="btn btn-primary"><UserPlus size={16} /> Add member</Link></>} />
      <div className="card">
        <form className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
          <input className="input max-w-sm" name="q" defaultValue={q} placeholder="Search name, phone, username or ID…" aria-label="Search people" />
          <input type="hidden" name="status" value={status} />
          <div className="tabs">{tabs.map(([v, l]) => <Link key={v} href={`/admin/members?status=${v}&q=${encodeURIComponent(q)}`} className={`tab ${status === v ? "active" : ""}`}>{l}</Link>)}</div>
        </form>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Name</th><th>Username</th><th>Phone</th><th>Status</th><th>Joined</th><th>Last attended</th></tr></thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td><Link href={`/admin/members/${p.id}`} className="font-semibold hover:text-blue-600">{p.full_name}</Link><span className="block text-xs text-slate-400">{p.person_code}</span></td>
                  <td className="username-badge">{p.username}</td>
                  <td>{p.phone}{p.is_child && <span className="block text-xs text-slate-400">parent: {p.guardian_name ?? "—"}</span>}</td>
                  <td><StatusPill value={p.status} />{p.is_child && <span className="pill pill-amber ml-1">child{ageOf(p.birthday) !== null ? ` · ${ageOf(p.birthday)}` : ""}</span>}{leaderUnit.has(p.id) && <span className="pill pill-blue ml-1" title="On the leaders list">leader · {leaderUnit.get(p.id)}</span>}</td>
                  <td>{formatDate(p.joined_at ?? p.created_at)}</td>
                  <td>{formatDate(lastSeen.get(p.id))}</td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={6} className="text-center text-slate-500">No members match your search.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
