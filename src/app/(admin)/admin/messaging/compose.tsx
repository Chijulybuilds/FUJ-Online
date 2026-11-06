"use client";
import { useEffect, useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { sendBroadcastAction } from "@/lib/actions/admin";

type Option = { value: string; label: string };
export function Compose({ audiences, defaultAudience, parentId, defaultKind = "general", defaultTitle = "", sms, email }: { audiences: Option[]; defaultAudience: string; parentId?: string; defaultKind?: string; defaultTitle?: string; sms: boolean; email: boolean }) {
  const [audience, setAudience] = useState(defaultAudience);
  const [preview, setPreview] = useState<{ count: number; sample: string[] } | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/admin/audience?audience=${encodeURIComponent(audience)}`).then((r) => r.json()).then((j) => live && setPreview(j)).catch(() => {});
    return () => { live = false; };
  }, [audience]);
  return (
    <ActionForm action={sendBroadcastAction} className="grid gap-4">
      {parentId && <input type="hidden" name="parent_id" value={parentId} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="label">Audience<select className="input mt-1" name="audience" value={audience} onChange={(e) => setAudience(e.target.value)}>{audiences.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</select></label>
        <label className="label">Type<select className="input mt-1" name="kind" defaultValue={defaultKind}><option value="general">General message</option><option value="announcement">Announcement</option><option value="follow_up">Follow-up</option></select></label>
      </div>
      <p className="text-xs text-slate-500" data-testid="audience-count">{preview ? <><b>{preview.count}</b> recipient{preview.count === 1 ? "" : "s"}{preview.sample.length ? ` · ${preview.sample.join(", ")}${preview.count > preview.sample.length ? "…" : ""}` : ""}</> : "Counting recipients…"}</p>
      <label className="label">Title<input className="input mt-1" name="title" required defaultValue={defaultTitle} placeholder="We missed you this Sunday" /></label>
      <label className="label">Message<span className="hint">Use {"{first_name}"} to personalise.</span><textarea className="input mt-1 min-h-32" name="body" required placeholder="Hi {first_name}, we missed you at church on Sunday. Is everything okay? Reply to let us know how we can pray for you." /></label>
      <fieldset className="flex flex-wrap gap-5">
        <label className="checkbox"><input type="checkbox" checked readOnly disabled /> In-app (member portal)</label>
        <label className="checkbox"><input type="checkbox" name="channels" value="sms" disabled={!sms} /> SMS {!sms && <span className="text-xs text-slate-400">(add TERMII_API_KEY)</span>}</label>
        <label className="checkbox"><input type="checkbox" name="channels" value="email" disabled={!email} /> Email {!email && <span className="text-xs text-slate-400">(add RESEND_API_KEY)</span>}</label>
      </fieldset>
      <label className="checkbox"><input type="checkbox" name="request_response" defaultChecked /> Ask recipients to respond (tracked)</label>
      <div><SubmitButton pendingText="Sending…">Send broadcast</SubmitButton></div>
    </ActionForm>
  );
}
