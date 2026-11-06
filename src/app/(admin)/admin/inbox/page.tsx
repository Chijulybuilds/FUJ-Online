import Link from "next/link";
import { PageHeading } from "@/components/ui/page-heading";
import { requireAdmin } from "@/lib/auth/session";
import { inboxThreads } from "@/lib/repo/messaging";
import { initials, timeAgo } from "@/lib/utils";

export default async function Inbox() {
  await requireAdmin("inbox");
  const threads = await inboxThreads();
  return (
    <>
      <PageHeading title="Inbox" description="Responses from members to broadcasts and direct messages." />
      <div className="card divide-y divide-slate-100">
        {threads.map((t) => (
          <Link key={t.personId} href={`/admin/inbox/${t.personId}`} className="flex items-start gap-4 p-5 hover:bg-slate-50">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">{initials(t.person?.full_name ?? "?")}</span>
            <div className="min-w-0 flex-1">
              <div className="flex justify-between gap-3"><p className="font-semibold">{t.person?.full_name ?? "Unknown"}</p><span className="text-xs text-slate-400">{timeAgo(t.latest.responded_at)}</span></div>
              <p className="text-xs text-slate-500">Re: {t.broadcast?.title}</p>
              <p className="mt-1 truncate text-sm text-slate-600">{t.latest.response}</p>
            </div>
          </Link>
        ))}
        {!threads.length && <p className="p-8 text-center text-sm text-slate-500">No responses yet. Send a broadcast with “Ask recipients to respond”.</p>}
      </div>
    </>
  );
}
