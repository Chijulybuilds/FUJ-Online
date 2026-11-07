import { PageHeading } from "@/components/ui/page-heading";
import { requireMember } from "@/lib/auth/session";
import { publishedAnnouncements } from "@/lib/repo/content";
import { formatDate } from "@/lib/utils";

export default async function MemberAnnouncements() {
  await requireMember();
  const items = await publishedAnnouncements();
  return (
    <>
      <PageHeading title="Church updates" description="Announcements from your church community." />
      <div className="space-y-4">
        {items.map((a) => <article key={a.id} className="card p-6"><p className="text-lg font-semibold">{a.pinned && "📌 "}{a.title}</p><p className="mt-1 text-xs text-slate-400">{formatDate(a.published_at)} · {a.author}</p><p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">{a.body}</p></article>)}
        {!items.length && <p className="empty">No announcements right now.</p>}
      </div>
    </>
  );
}
