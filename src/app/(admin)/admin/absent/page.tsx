import Link from "next/link";
import { MessageCircle, Phone, Send, Settings } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { absentMembers } from "@/lib/repo/absence";
import { firstName } from "@/lib/identity-utils";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Members who missed the last N Sundays — the follow-up list (also sent weekly by SMS to the pastor and admins). */
export default async function MissedSundaysPage() {
  const admin = await requireAdmin("first_timers");
  const { absentees, threshold } = await absentMembers();
  return (
    <>
      <PageHeading
        title="Missed Sundays"
        description={`Members who have missed the last ${threshold} Sunday${threshold === 1 ? "" : "s"} in a row — give them a call. Only Sundays where attendance was taken count; anyone who came to any service since isn't listed.`}
        action={<>
          {can(admin.role, "messaging") && absentees.length > 0 && <Link href="/admin/messaging?audience=absentees" className="btn btn-secondary"><Send size={16} /> Message them</Link>}
          {can(admin.role, "settings") && <Link href="/admin/settings#absence-report" className="btn btn-secondary"><Settings size={16} /> Weekly SMS report</Link>}
        </>}
      />
      <div className="card">
        <ul className="divide-y divide-slate-100" data-testid="absent-list">
          {absentees.map(({ person: p, lastSeen, missed }) => {
            const hello = encodeURIComponent(`Hello ${firstName(p.full_name)}, this is FlagUpJesus Global Ministry. We've missed you at church these past Sundays — we hope you're well! We'd love to see you this Sunday.`);
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4 sm:px-5" data-testid="absent-row">
                <div className="min-w-[14rem] flex-1">
                  <Link href={`/admin/members/${p.id}`} className="font-semibold hover:text-blue-600">{p.full_name}</Link>
                  <span className="pill pill-amber ml-2">Missed {missed} Sunday{missed === 1 ? "" : "s"}</span>
                  <span className="block text-xs text-slate-500">{p.phone} · last in church {formatDate(lastSeen, { weekday: "short", day: "numeric", month: "short" })}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a className="btn btn-secondary btn-sm" href={`tel:${p.normalized_phone}`} aria-label={`Call ${p.full_name}`}><Phone size={14} /> Call</a>
                  <a className="btn btn-secondary btn-sm" target="_blank" rel="noreferrer" href={`https://wa.me/${p.normalized_phone.replace(/^\+/, "")}?text=${hello}`}><MessageCircle size={14} /> WhatsApp</a>
                </div>
              </li>
            );
          })}
          {!absentees.length && <li className="py-12 text-center text-slate-500">Nobody has missed the last {threshold} Sundays. 🙌</li>}
        </ul>
      </div>
    </>
  );
}
