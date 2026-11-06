import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/ui/page-heading";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { requireAdmin } from "@/lib/auth/session";
import { threadForPerson } from "@/lib/repo/messaging";
import { replyToPersonAction } from "@/lib/actions/admin";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { providers } from "@/lib/messaging/providers";

export default async function Conversation({ params }: { params: Promise<{ conversationId: string }> }) {
  await requireAdmin("inbox");
  const { conversationId } = await params;
  const person = await db().get("people", { id: conversationId }).catch(() => null);
  if (!person) notFound();
  const thread = await threadForPerson(person.id);
  return (
    <>
      <PageHeading title={person.full_name} description={<>{person.phone} · <Link className="text-blue-600" href={`/admin/members/${person.id}`}>View record</Link></>} />
      <div className="card max-w-3xl p-6">
        <ol className="space-y-5">
          {thread.map((m) => (
            <li key={m.id} className="space-y-2">
              <div className="mr-10 rounded-2xl rounded-tl-sm bg-slate-50 p-4 text-sm"><p className="font-semibold">{m.broadcast.title}</p><p className="mt-1 whitespace-pre-line text-slate-600">{m.broadcast.body}</p><p className="mt-2 text-[11px] text-slate-400">{m.broadcast.created_by} · {formatDateTime(m.created_at)} · {m.read_at ? "read" : "unread"}</p></div>
              {m.response && <div className="ml-10 rounded-2xl rounded-tr-sm bg-blue-50 p-4 text-sm"><p className="whitespace-pre-line">{m.response}</p><p className="mt-2 text-[11px] text-slate-400">{formatDateTime(m.responded_at)}</p></div>}
            </li>
          ))}
          {!thread.length && <li className="text-sm text-slate-500">No messages yet.</li>}
        </ol>
        <ActionForm action={replyToPersonAction} className="mt-6 space-y-3 border-t border-slate-100 pt-5" resetOnSuccess>
          <input type="hidden" name="person_id" value={person.id} />
          <input className="input" name="title" placeholder="Subject (optional)" />
          <textarea className="input" name="body" placeholder={`Reply to ${person.full_name.split(" ")[0]}…`} required />
          {(providers.whatsapp || providers.sms) && <label className="checkbox"><input type="checkbox" name="channels" value="whatsapp" defaultChecked /> Also send to their phone ({person.whatsapp === "no" ? "SMS" : providers.whatsapp ? "WhatsApp, or SMS if not on WhatsApp" : "SMS"})</label>}
          <SubmitButton pendingText="Sending…">Send reply</SubmitButton>
        </ActionForm>
      </div>
    </>
  );
}
