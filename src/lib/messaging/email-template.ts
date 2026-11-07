/** Simple, email-client-safe HTML for broadcasts (inline styles, no external CSS). */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const linkify = (s: string) => s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#c8102e">$1</a>');

export function broadcastEmailHtml(input: { title: string; body: string; imageUrl?: string | null; churchName: string; siteUrl: string; motto?: string | null }) {
  const paragraphs = input.body.split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px;line-height:1.6">${linkify(esc(p)).replace(/\n/g, "<br>")}</p>`).join("");
  const flyer = input.imageUrl ? `<img src="${esc(input.imageUrl)}" alt="Flyer" width="520" style="display:block;width:100%;max-width:520px;height:auto;border-radius:12px;margin:0 0 18px">` : "";
  return `<!doctype html><html><body style="margin:0;background:#f7f4f2;font-family:Arial,Helvetica,sans-serif;color:#1b1b1b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f4f2;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#c8102e;color:#ffffff;padding:18px 24px;font-weight:bold;font-size:16px">${esc(input.churchName)}</td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">${esc(input.title)}</h1>
${flyer}${paragraphs}
</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #eee;font-size:12px;color:#777">${input.motto ? `${esc(input.motto)} · ` : ""}<a href="${esc(input.siteUrl)}" style="color:#c8102e">${esc(input.siteUrl.replace(/^https?:\/\//, ""))}</a></td></tr>
</table></td></tr></table></body></html>`;
}
