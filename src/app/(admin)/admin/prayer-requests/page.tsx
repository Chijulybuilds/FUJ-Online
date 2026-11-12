import Link from "next/link";
import { PageHeading } from "@/components/ui/page-heading";
import { StatusPill } from "@/components/ui/status-pill";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { requireAdmin } from "@/lib/auth/session";
import { listPrayers } from "@/lib/repo/content";
import { updatePrayerAction } from "@/lib/actions/admin";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";

const VIS = { private: "🔒 Pastor only", pastoral: "Pastoral team", public: "Can be shared on prayer wall" } as Record<string, string>;

export default async function PrayerRequestsAdmin({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const admin = await requireAdmin("prayer");
  const { status = "pending" } = await searchParams;
  const [all, staff] = await Promise.all([listPrayers(), db().list("admin_users", { where: { active: true } })]);
  // "private" requests are restricted to pastors and admins.
  const visible = all.filter((p) => p.visibility !== "private" || ["super_admin", "admin", "pastor"].includes(admin.role));
  const shown = visible.filter((p) => status === "all" || p.status === status);
  const tabs = [["pending", "New"], ["praying", "Praying"], ["answered", "Answered"], ["closed", "Closed"], ["all", "All"]];
  return (
    <>
      <PageHeading title="Prayer requests" description="Confidential by default. Only requests the requester marked shareable can appear on the prayer wall." />
      <div className="tabs mb-4">{tabs.map(([v, l]) => <Link key={v} href={`/admin/prayer-requests?status=${v}`} className={`tab ${status === v ? "active" : ""}`}>{l} ({v === "all" ? visible.length : visible.filter((p) => p.status === v).length})</Link>)}</div>
      <div className="grid gap-4 lg:grid-cols-2">
        {shown.map((p) => (
          <article key={p.id} className="card p-5" data-testid="prayer-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{p.person ? <Link href={`/admin/members/${p.person.id}`} className="hover:text-blue-600">{p.person.full_name}</Link> : p.requester_name ?? "Anonymous guest"}{p.is_anonymous && <span className="ml-2 text-xs text-slate-400">(anonymous on wall)</span>}</p>
                <p className="text-xs text-slate-500">{formatDateTime(p.created_at)} · {VIS[p.visibility]}{p.requester_contact ? ` · ${p.requester_contact}` : ""}</p>
              </div>
              <StatusPill value={p.status} />
            </div>
            <p className="mt-3 whitespace-pre-line text-sm">{p.request_text}</p>
            {p.on_wall && <p className="mt-2 text-xs text-blue-600">On prayer wall · 🙏 {p.prayed_count} praying</p>}
            <ActionForm action={updatePrayerAction} className="mt-4 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2">
              <input type="hidden" name="id" value={p.id} />
              <select className="input" name="status" defaultValue={p.status === "approved" ? "praying" : p.status === "declined" ? "closed" : p.status} aria-label="Status"><option value="pending">New</option><option value="praying">Praying</option><option value="answered">Answered</option><option value="closed">Closed</option></select>
              <select className="input" name="assignee" defaultValue={p.assignee ?? ""} aria-label="Assign"><option value="">Unassigned</option>{staff.map((s) => <option key={s.id} value={s.full_name}>{s.full_name}</option>)}</select>
              <textarea className="input sm:col-span-2 min-h-16" name="admin_note" defaultValue={p.admin_note ?? ""} placeholder="Private pastoral note" />
              <div className="flex flex-wrap gap-4 sm:col-span-2">
                {p.visibility === "public" && <label className="checkbox"><input type="checkbox" name="on_wall" defaultChecked={p.on_wall} /> Show on prayer wall</label>}
              </div>
              <div><SubmitButton className="btn btn-secondary btn-sm">Update</SubmitButton></div>
            </ActionForm>
          </article>
        ))}
        {!shown.length && <p className="empty lg:col-span-2">No prayer requests in this list.</p>}
      </div>
    </>
  );
}
