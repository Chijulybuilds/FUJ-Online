import { PageHeading } from "@/components/ui/page-heading";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { requireMember } from "@/lib/auth/session";
import { memberMessages } from "@/lib/repo/messaging";
import { markReadAction, respondAction } from "@/lib/actions/member";
import { formatDateTime } from "@/lib/utils";

export default async function MemberMessages({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const me = await requireMember();
  const { open } = await searchParams;
  const messages = await memberMessages(me.personId);
  return (
    <>
      <PageHeading title="Messages" description="Messages from your pastors and church team. Your replies go straight to them." />
      <div className="space-y-4">
        {messages.map((m) => {
          const expanded = open === m.id || Boolean(m.read_at);
          return (
            <article key={m.id} className={`card p-5 ${!m.read_at ? "border-l-4 border-l-red-600" : ""}`} data-testid="member-message">
              <div className="flex items-start justify-between gap-3">
                <div><p className="font-semibold">{!m.read_at && <span className="pill pill-red mr-2">New</span>}{m.broadcast.title}</p><p className="text-xs text-slate-400">{m.broadcast.created_by} · {formatDateTime(m.created_at)}</p></div>
              </div>
              {expanded ? (
                <>
                  <p className="mt-3 whitespace-pre-line text-sm text-slate-700">{m.broadcast.body.replaceAll("{first_name}", me.name.split(" ")[0])}</p>
                  {m.response && <div className="mt-4 rounded-xl bg-blue-50 p-3 text-sm"><p className="text-xs font-semibold text-blue-700">Your reply</p><p className="mt-1 whitespace-pre-line">{m.response}</p></div>}
                  <ActionForm action={respondAction} className="mt-4 flex flex-col gap-2 sm:flex-row" resetOnSuccess>
                    <input type="hidden" name="id" value={m.id} />
                    <input className="input" name="response" placeholder={m.broadcast.request_response ? "Reply to the church team…" : "Reply (optional)"} aria-label="Reply" required />
                    <SubmitButton className="btn btn-primary" pendingText="Sending…">Reply</SubmitButton>
                  </ActionForm>
                </>
              ) : (
                <ActionForm action={markReadAction} className="mt-3"><input type="hidden" name="id" value={m.id} /><SubmitButton className="btn btn-secondary btn-sm" pendingText="Opening…">Read message</SubmitButton></ActionForm>
              )}
            </article>
          );
        })}
        {!messages.length && <p className="empty">No messages yet.</p>}
      </div>
    </>
  );
}
