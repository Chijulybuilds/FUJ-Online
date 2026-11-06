import Link from "next/link";
import { Download, UserPlus } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { StatusPill } from "@/components/ui/status-pill";
import { requireAdmin } from "@/lib/auth/session";
import { listPeople } from "@/lib/repo/people";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  await requireAdmin("members");
  const { q = "", status = "" } = await searchParams;
  const [people, attendance] = await Promise.all([listPeople(), db().list("attendance")]);
  const lastSeen = new Map<string, string>();
  attendance.forEach((a) => { if ((lastSeen.get(a.person_id) ?? "") < a.checked_in_at) lastSeen.set(a.person_id, a.checked_in_at); });
  const term = q.toLowerCase();
  const filtered = people.filter((p) => (!status || p.status === status) && (!term || `${p.full_name} ${p.phone} ${p.normalized_phone} ${p.username} ${p.person_code} ${p.email}`.toLowerCase().includes(term)));
  const tabs = [["", "All"], ["member", "Members"], ["visitor", "Visitors"], ["inactive", "Inactive"]];
  return (
    <>
      <PageHeading title="People directory" description={`${people.length} people · every person gets a unique flag username at registration.`}
        action={<><a href="/api/admin/export?type=people" className="btn btn-secondary"><Download size={16} /> Export CSV</a><Link href="/admin/members/new" className="btn btn-primary"><UserPlus size={16} /> Add person</Link></>} />
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
                  <td>{p.phone}</td>
                  <td><StatusPill value={p.status} /></td>
                  <td>{formatDate(p.joined_at ?? p.created_at)}</td>
                  <td>{formatDate(lastSeen.get(p.id))}</td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={6} className="text-center text-slate-500">No people match your search.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
