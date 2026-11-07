"use client";
import { useEffect, useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { sendBroadcastAction } from "@/lib/actions/admin";

type Option = { value: string; label: string };
export function Compose({ audiences, defaultAudience, parentId, defaultKind = "general", defaultTitle = "", sms, email, whatsapp = false }: { audiences: Option[]; defaultAudience: string; parentId?: string; defaultKind?: string; defaultTitle?: string; sms: boolean; email: boolean; whatsapp?: boolean }) {
  const [audience, setAudience] = useState(defaultAudience);
  const [preview, setPreview] = useState<{ count: number; sample: string[] } | null>(null);
  const [flyer, setFlyer] = useState(""); const [uploading, setUploading] = useState(false); const [flyerError, setFlyerError] = useState("");
  async function upload(file: File | undefined) {
    if (!file) return;
    setFlyerError(""); setUploading(true);
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const json = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) { setFlyerError(json.error ?? "Upload failed."); return; }
    setFlyer(json.url);
  }
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
      <div className="label">Flyer <span className="font-normal text-slate-400">(optional — program flyer or image)</span>
        <input type="hidden" name="image_url" value={flyer} />
        {flyer ? (
          <div className="mt-2 flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- uploaded flyer preview */}
            <img src={flyer} alt="Flyer preview" className="h-28 w-auto rounded-xl border border-slate-200 object-cover" data-testid="flyer-preview" />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFlyer("")}>Remove</button>
          </div>
        ) : (
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="input mt-2 cursor-pointer text-sm font-normal" aria-label="Flyer image" disabled={uploading} onChange={(e) => void upload(e.target.files?.[0])} />
        )}
        {uploading && <span className="hint">Uploading…</span>}
        {flyerError && <span className="mt-1 block text-xs font-normal text-red-600">{flyerError}</span>}
      </div>
      <fieldset className="grid gap-3 rounded-xl border border-slate-100 p-4" data-testid="channels">
        <legend className="px-1 text-sm font-semibold">Send to</legend>
        <label className="checkbox"><input type="checkbox" checked readOnly disabled /> <span>App inbox <span className="block text-xs text-slate-400">Always — members see it in their portal</span></span></label>
        <label className="checkbox"><input type="checkbox" name="channels" value="whatsapp" disabled={!whatsapp} defaultChecked={whatsapp} /> <span>WhatsApp <span className="block text-xs text-slate-400">{whatsapp ? (sms ? "Personal WhatsApp message · SMS for anyone not on WhatsApp" : "Personal WhatsApp message") : "Not set up yet — see Settings → Messaging channels"}</span></span></label>
        <label className="checkbox"><input type="checkbox" name="channels" value="sms" disabled={!sms} defaultChecked={sms && !whatsapp} /> <span>SMS text message <span className="block text-xs text-slate-400">{sms ? (whatsapp ? "Also text everyone (on top of WhatsApp)" : "Text message to everyone's phone") : "Not set up yet — see Settings → Messaging channels"}</span></span></label>
        <label className="checkbox"><input type="checkbox" name="channels" value="email" disabled={!email} defaultChecked={email} /> <span>Email <span className="block text-xs text-slate-400">{email ? "To everyone who has an email address" : "Not set up yet — see Settings → Messaging channels"}</span></span></label>
        {!whatsapp && !sms && <p className="text-xs text-slate-500">Free option: after sending, use “Share on WhatsApp” on the message page.</p>}
      </fieldset>
      <label className="checkbox"><input type="checkbox" name="request_response" defaultChecked /> Ask recipients to respond (tracked)</label>
      <div><SubmitButton pendingText="Sending…">Send broadcast</SubmitButton></div>
    </ActionForm>
  );
}
