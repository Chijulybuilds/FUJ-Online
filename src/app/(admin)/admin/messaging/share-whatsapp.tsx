"use client";
import { useState } from "react";
import { Copy, Download, Share2 } from "lucide-react";

/** Builds the message people will see in WhatsApp (no personalisation in group / broadcast-list sends). */
export function shareText(title: string, body: string, link?: string) {
  const text = body.replaceAll("{first_name}", "family").replaceAll("{username}", "").trim();
  return `*${title}*\n\n${text}\n\n— FlagUpJesus Global Ministry${link ? `\n${link}` : ""}`;
}

/**
 * Free WhatsApp distribution: one tap opens WhatsApp's share sheet with the flyer image + message,
 * then the admin picks the church's broadcast lists, groups, Status or Channel.
 */
export function ShareToWhatsApp({ title, body, imageUrl, siteUrl }: { title: string; body: string; imageUrl: string | null; siteUrl: string }) {
  const [note, setNote] = useState("");
  const text = shareText(title, body, siteUrl);
  async function share() {
    setNote("");
    try {
      if (imageUrl && navigator.canShare) {
        const blob = await (await fetch(imageUrl)).blob();
        const file = new File([blob], `flagupjesus-flyer.${(blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg")}`, { type: blob.type });
        if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text, title }); return; }
      }
      if (navigator.share && !imageUrl) { await navigator.share({ text, title }); return; }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return; // user closed the sheet
    }
    // Desktop / unsupported: WhatsApp (Web) with the text; attach the downloaded flyer there.
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    if (imageUrl) setNote("WhatsApp opened with the message. Download the flyer and attach it in the chat (📎).");
  }
  return (
    <section className="card p-6" data-testid="share-whatsapp">
      <h2 className="flex items-center gap-2 font-bold"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#25d366] text-white"><Share2 size={16} /></span> Share to WhatsApp — free</h2>
      <p className="mt-1 text-xs text-slate-500">Opens WhatsApp with the flyer and message. Pick your FUJ <b>broadcast lists</b>, <b>groups</b>, <b>Status</b> or <b>Channel</b> and send — no API, no per-message cost.</p>
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- uploaded flyer
        <img src={imageUrl} alt="Flyer" className="mt-4 max-h-64 w-auto rounded-xl border border-slate-100" />
      )}
      <pre className="mt-4 max-h-40 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 font-sans text-xs text-slate-700" data-testid="share-text">{text}</pre>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" style={{ background: "#1fa855" }} onClick={() => void share()}><Share2 size={15} /> Share on WhatsApp</button>
        <button type="button" className="btn btn-secondary" onClick={async () => { try { await navigator.clipboard.writeText(text); setNote("Message copied."); } catch { setNote("Copy failed — select the text above."); } }}><Copy size={15} /> Copy message</button>
        {imageUrl && <a className="btn btn-secondary" href={imageUrl} download><Download size={15} /> Download flyer</a>}
      </div>
      {note && <p className="alert alert-ok mt-3">{note}</p>}
    </section>
  );
}
