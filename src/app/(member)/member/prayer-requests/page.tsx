import { PageHeading } from "@/components/ui/page-heading";
import { StatusPill } from "@/components/ui/status-pill";
import { PrayedButton, PrayerForm } from "@/components/shared/prayer-form";
import { requireMember } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { prayerWall } from "@/lib/repo/content";
import { myPrayerCloseAction } from "@/lib/actions/member";
import { formatDate } from "@/lib/utils";

export default async function PrayerRequests() {
  const me = await requireMember();
  const [mine, wall] = await Promise.all([db().list("prayer_requests", { where: { person_id: me.personId }, order: { column: "created_at", ascending: false } }), prayerWall()]);
  return (
    <>
      <PageHeading title="Prayer" description="“The prayer of a righteous person is powerful and effective.” — James 5:16" />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6"><h2 className="mb-4 font-bold">New prayer request</h2><PrayerForm /></section>
        <section className="card p-6">
          <h2 className="font-bold">My requests</h2>
          <ul className="mt-3 space-y-3">
            {mine.map((p) => (
              <li key={p.id} className="rounded-xl border border-slate-100 p-3 text-sm" data-testid="my-prayer">
                <div className="flex justify-between gap-2"><span className="text-xs text-slate-400">{formatDate(p.created_at)}</span><StatusPill value={p.status} /></div>
                <p className="mt-1">{p.request_text}</p>
                {p.status !== "answered" && p.status !== "closed" && <form action={myPrayerCloseAction} className="mt-2"><input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value="answered" /><button className="btn btn-ghost btn-sm">🎉 Mark as answered</button></form>}
              </li>
            ))}
            {!mine.length && <li className="text-sm text-slate-500">You haven&apos;t sent any requests yet.</li>}
          </ul>
        </section>
      </div>
      <section className="mt-8">
        <h2 className="mb-3 font-bold">Prayer wall</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {wall.map((p) => <article key={p.id} className="card p-5"><p className="text-sm">{p.request_text}</p><div className="mt-4 flex items-center justify-between"><span className="text-xs text-slate-400">— {p.displayName}</span><PrayedButton id={p.id} count={p.prayed_count} /></div></article>)}
          {!wall.length && <p className="empty md:col-span-3">No shared requests right now.</p>}
        </div>
      </section>
    </>
  );
}
