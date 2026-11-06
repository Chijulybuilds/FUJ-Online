import Link from "next/link";
import { PageHeading } from "@/components/ui/page-heading";
import { StatusPill } from "@/components/ui/status-pill";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { requireAdmin } from "@/lib/auth/session";
import { listTestimonies } from "@/lib/repo/content";
import { moderateTestimonyAction } from "@/lib/actions/admin";
import { formatDate } from "@/lib/utils";

export default async function TestimoniesAdmin({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin("testimonies");
  const { status = "pending" } = await searchParams;
  const all = await listTestimonies();
  const shown = all.filter((t) => status === "all" || t.status === status);
  return (
    <>
      <PageHeading title="Testimonies" description="Review before publishing. Only testimonies with the author's consent can be published." />
      <div className="tabs mb-4">{[["pending", "To review"], ["approved", "Approved"], ["published", "Published"], ["declined", "Declined"], ["all", "All"]].map(([v, l]) => <Link key={v} href={`/admin/testimonies?status=${v}`} className={`tab ${status === v ? "active" : ""}`}>{l} ({v === "all" ? all.length : all.filter((t) => t.status === v).length})</Link>)}</div>
      <div className="grid gap-4 lg:grid-cols-2">
        {shown.map((t) => (
          <article key={t.id} className="card p-5" data-testid="testimony-card">
            <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{t.featured && "⭐ "}{t.title}</p><p className="text-xs text-slate-500">{t.person?.full_name ?? "Unknown"} · {formatDate(t.created_at)} · {t.consent_to_publish ? "consented to publish" : "private — do not publish"}</p></div><StatusPill value={t.status} /></div>
            <p className="mt-3 whitespace-pre-line text-sm text-slate-600">{t.body}</p>
            <ActionForm action={moderateTestimonyAction} className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
              <input type="hidden" name="id" value={t.id} />
              <label className="checkbox mr-2"><input type="checkbox" name="featured" defaultChecked={t.featured} /> Feature</label>
              {t.consent_to_publish && <SubmitButton name="status" value="published" className="btn btn-primary btn-sm">Publish</SubmitButton>}
              <SubmitButton name="status" value="approved" className="btn btn-secondary btn-sm">Approve (portal only)</SubmitButton>
              <SubmitButton name="status" value="declined" className="btn btn-ghost btn-sm">Decline</SubmitButton>
            </ActionForm>
          </article>
        ))}
        {!shown.length && <p className="empty lg:col-span-2">Nothing in this list.</p>}
      </div>
    </>
  );
}
