import { PageHeading } from "@/components/ui/page-heading";
import { StatusPill } from "@/components/ui/status-pill";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { requireMember } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { publishedTestimonies } from "@/lib/repo/content";
import { submitTestimonyAction } from "@/lib/actions/member";
import { formatDate } from "@/lib/utils";

export default async function Testimonies() {
  const me = await requireMember();
  const [published, mine] = await Promise.all([publishedTestimonies(), db().list("testimonies", { where: { person_id: me.personId }, order: { column: "created_at", ascending: false } })]);
  const approved = (await db().list("testimonies", { where: { status: "approved" } }));
  return (
    <>
      <PageHeading title="Testimonies" description="Celebrate what God is doing in our community." />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <section className="card p-6">
          <h2 className="mb-4 font-bold">Share your testimony</h2>
          <ActionForm action={submitTestimonyAction} className="grid gap-3" resetOnSuccess>
            <input className="input" name="title" required placeholder="e.g. God healed my son" aria-label="Title" />
            <textarea className="input min-h-40" name="body" required placeholder="Tell us what God did…" aria-label="Testimony" />
            <label className="checkbox"><input type="checkbox" name="consent" defaultChecked /> I&apos;m happy for this to be shared publicly (church website &amp; services)</label>
            <div><SubmitButton pendingText="Sending…">Submit testimony</SubmitButton></div>
          </ActionForm>
          {mine.length > 0 && <><h3 className="mt-6 text-sm font-semibold">My testimonies</h3><ul className="mt-2 space-y-2 text-sm">{mine.map((t) => <li key={t.id} className="flex justify-between gap-3"><span>{t.title}</span><StatusPill value={t.status} /></li>)}</ul></>}
        </section>
        <section className="space-y-4">
          {[...published, ...approved.filter((a) => !published.some((p) => p.id === a.id)).map((a) => ({ ...a, person: null }))].map((t) => (
            <article key={t.id} className="card p-6"><p className="font-display text-4xl leading-none text-blue-600">“</p><p className="font-semibold">{t.featured && "⭐ "}{t.title}</p><p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{t.body}</p><p className="mt-3 text-xs text-slate-400">{t.person?.full_name ?? "A church member"} · {formatDate(t.published_at ?? t.created_at)}</p></article>
          ))}
          {!published.length && !approved.length && <p className="empty">No testimonies yet — be the first!</p>}
        </section>
      </div>
    </>
  );
}
