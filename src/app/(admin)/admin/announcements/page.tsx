import { PageHeading } from "@/components/ui/page-heading";
import { StatusPill } from "@/components/ui/status-pill";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { requireAdmin } from "@/lib/auth/session";
import { listAnnouncements } from "@/lib/repo/content";
import { announcementStatusAction, saveAnnouncementAction } from "@/lib/actions/admin";
import { providers } from "@/lib/messaging/providers";
import { formatDate } from "@/lib/utils";

const AUD = { all: "Everyone", members: "Members", visitors: "Visitors" } as Record<string, string>;

export default async function AnnouncementsPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  await requireAdmin("announcements");
  const { edit } = await searchParams;
  const items = await listAnnouncements();
  const current = items.find((a) => a.id === edit);
  return (
    <>
      <PageHeading title="Announcements" description="Publish updates to the member portal and landing page — and optionally broadcast them." />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <section className="card p-6">
          <h2 className="mb-4 font-bold">{current ? "Edit announcement" : "New announcement"}</h2>
          <ActionForm key={current?.id ?? "new"} action={saveAnnouncementAction} className="grid gap-4" resetOnSuccess={!current}>
            {current && <input type="hidden" name="id" value={current.id} />}
            <label className="label">Title<input className="input mt-1" name="title" required defaultValue={current?.title} /></label>
            <label className="label">Body<textarea className="input mt-1 min-h-32" name="body" required defaultValue={current?.body} /></label>
            <label className="label">Audience<select className="input mt-1" name="audience" defaultValue={current?.audience ?? "all"}><option value="all">Everyone</option><option value="members">Members</option><option value="visitors">Visitors</option></select></label>
            <div className="flex flex-wrap gap-5">
              <label className="checkbox"><input type="checkbox" name="pinned" defaultChecked={current?.pinned} /> Pin to top</label>
              <label className="checkbox"><input type="checkbox" name="is_public" defaultChecked={current?.is_public ?? true} /> Show on public landing page</label>
            </div>
            <div className="rounded-xl border border-slate-100 p-4">
              <label className="checkbox"><input type="checkbox" name="broadcast" /> Also broadcast when publishing</label>
              <div className="mt-2 flex gap-5 pl-6 text-xs">
                <label className="checkbox"><input type="checkbox" name="channels" value="whatsapp" disabled={!providers.sms && !providers.whatsapp} /> WhatsApp / SMS</label>
                <label className="checkbox"><input type="checkbox" name="channels" value="email" disabled={!providers.email} /> Email</label>
              </div>
            </div>
            <div className="flex gap-2"><SubmitButton name="intent" value="publish" pendingText="Publishing…">Publish</SubmitButton><SubmitButton name="intent" value="draft" className="btn btn-secondary">Save draft</SubmitButton></div>
          </ActionForm>
        </section>
        <section className="card divide-y divide-slate-100">
          {items.map((a) => (
            <article key={a.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="font-semibold">{a.pinned && "📌 "}{a.title}</p><p className="mt-1 text-xs text-slate-500">{AUD[a.audience] ?? a.audience} · {formatDate(a.published_at ?? a.created_at)} · {a.is_public ? "public" : "portal only"}</p></div>
                <StatusPill value={a.status} />
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-slate-600">{a.body}</p>
              <div className="mt-3 flex gap-2">
                <a href={`/admin/announcements?edit=${a.id}`} className="btn btn-secondary btn-sm">Edit</a>
                <form action={announcementStatusAction}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="status" value={a.status === "published" ? "archived" : "published"} /><button className="btn btn-ghost btn-sm">{a.status === "published" ? "Archive" : "Publish"}</button></form>
              </div>
            </article>
          ))}
          {!items.length && <p className="p-8 text-center text-sm text-slate-500">No announcements yet.</p>}
        </section>
      </div>
    </>
  );
}
