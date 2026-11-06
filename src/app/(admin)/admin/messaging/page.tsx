import Link from "next/link";
import { PageHeading } from "@/components/ui/page-heading";
import { StatusPill } from "@/components/ui/status-pill";
import { requireAdmin } from "@/lib/auth/session";
import { AUDIENCES, listBroadcasts } from "@/lib/repo/messaging";
import { providers } from "@/lib/messaging/providers";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { Compose } from "./compose";

export default async function MessagingPage({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  await requireAdmin("messaging");
  const { to } = await searchParams;
  const [broadcasts, departments, person] = await Promise.all([
    listBroadcasts(), db().list("departments", { where: { is_active: true } }), to ? db().get("people", { id: to }).catch(() => null) : null
  ]);
  const audiences = [
    ...(person ? [{ value: `person:${person.id}`, label: `Direct: ${person.full_name}` }] : []),
    ...AUDIENCES,
    ...departments.map((d) => ({ value: `department:${d.id}`, label: `Department: ${d.name}` }))
  ];
  return (
    <>
      <PageHeading title="Broadcasts & follow-up" description="Send announcements and follow-up messages, then track who read and who responded." />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <section className="card p-6"><h2 className="mb-4 font-bold">New broadcast</h2><Compose audiences={audiences} defaultAudience={person ? `person:${person.id}` : "all"} sms={providers.sms} email={providers.email} whatsapp={providers.whatsapp} /></section>
        <section className="card">
          <div className="border-b border-slate-100 p-5"><h2 className="font-bold">Sent ({broadcasts.length})</h2></div>
          <ul className="divide-y divide-slate-100">
            {broadcasts.map((b) => (
              <li key={b.id}>
                <Link href={`/admin/messaging/${b.id}`} className="block p-5 hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{b.parent_id ? "↳ " : ""}{b.title}</p><p className="mt-1 text-xs text-slate-500">{b.audienceLabel} · {formatDateTime(b.sent_at)} · by {b.created_by}</p></div><StatusPill value={b.kind.replace("_", " ")} /></div>
                  <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                    <span><b className="text-base">{b.stats.total}</b> sent</span>
                    <span><b className="text-base">{b.stats.readRate}%</b> read</span>
                    <span><b className="text-base">{b.stats.responded}</b> responses</span>
                  </div>
                  <div className="progress mt-2"><span style={{ width: `${b.stats.readRate}%` }} /></div>
                </Link>
              </li>
            ))}
            {!broadcasts.length && <li className="p-5 text-sm text-slate-500">No broadcasts sent yet.</li>}
          </ul>
        </section>
      </div>
    </>
  );
}
