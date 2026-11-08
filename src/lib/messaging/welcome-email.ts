/** Welcome + password emails (inline styles only, so they look right in Gmail, Outlook and phone mail apps). */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Church = { churchName: string; siteUrl: string; motto?: string | null; address?: string | null; phone?: string | null; email?: string | null; programs: { name: string; when: string }[] };

function frame(church: Church, inner: string) {
  return `<!doctype html><html><body style="margin:0;background:#f7f4f2;font-family:Arial,Helvetica,sans-serif;color:#1b1b1b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f4f2;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden">
<tr><td style="background:#c8102e;color:#ffffff;padding:20px 26px"><div style="font-size:12px;letter-spacing:2px;opacity:.85">FUJ ONLINE CHURCH</div><div style="font-weight:bold;font-size:18px;margin-top:4px">${esc(church.churchName)}</div></td></tr>
<tr><td style="padding:26px">${inner}</td></tr>
<tr><td style="padding:16px 26px;border-top:1px solid #eee;font-size:12px;line-height:1.6;color:#777">
${church.motto ? `<b style="color:#c8102e">${esc(church.motto)}</b><br>` : ""}${church.address ? `${esc(church.address)}<br>` : ""}${church.phone ? `${esc(church.phone)} · ` : ""}<a href="${esc(church.siteUrl)}" style="color:#c8102e">${esc(church.siteUrl.replace(/^https?:\/\//, ""))}</a>
</td></tr></table></td></tr></table></body></html>`;
}

const button = (href: string, label: string, primary = true) =>
  `<a href="${esc(href)}" style="display:inline-block;padding:13px 22px;border-radius:12px;font-weight:bold;font-size:15px;text-decoration:none;${primary ? "background:#c8102e;color:#ffffff" : "background:#ffffff;color:#c8102e;border:2px solid #c8102e"}">${esc(label)}</a>`;

export type WelcomeEmail = {
  firstName: string; username: string; setPasswordUrl: string; dashboardUrl: string; hasPassword: boolean;
  /** Under 18 on a parent's / guardian's phone number. */
  parentsPhone: boolean;
};

export function welcomeEmail(w: WelcomeEmail, church: Church) {
  const subject = `Welcome to FUJ Online Church, ${w.firstName}! Your flag username is inside 🎉`;
  const signIn = w.parentsPhone ? "your username and your parent's or guardian's phone number" : "your username and your phone number";
  const programs = church.programs.slice(0, 4);
  const text = [
    `Hi ${w.firstName},`,
    "",
    "Welcome to the FlagUpJesus family — we're so glad you're here! 💗",
    "At FlagUpJesus Global Ministry we raise apostolic believers, bringing hope and liberty to mankind. We love, we give, and we change the world — and now you're part of it.",
    "",
    `YOUR FLAG USERNAME: ${w.username}`,
    "",
    `• Every Sunday: scan the QR code on the screen and type ${w.username} to check in.`,
    `• Your membership dashboard: sign in with ${signIn}.`,
    "",
    w.hasPassword ? "You already have a password — you can also sign in with your username and password." : `Would you love to sign in with a password instead? Set one here (this link works for 30 days):\n${w.setPasswordUrl}`,
    "",
    `Open your dashboard: ${w.dashboardUrl}`,
    ...(programs.length ? ["", "Join us:", ...programs.map((p) => `• ${p.name}${p.when ? ` — ${p.when}` : ""}`)] : []),
    "",
    "With love,",
    "The FlagUpJesus family"
  ].join("\n");
  const html = frame(church, `
<h1 style="margin:0 0 6px;font-size:24px;line-height:1.3">Welcome to the family, ${esc(w.firstName)}! 🎉</h1>
<p style="margin:0 0 16px;line-height:1.6;color:#444">We&rsquo;re so glad you&rsquo;re here. At FlagUpJesus Global Ministry we raise apostolic believers, bringing hope and liberty to mankind &mdash; <b>we love, we give, and we change the world</b>. And now you&rsquo;re part of it. 💗</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff3f4;border:2px dashed #e9a1a7;border-radius:14px;margin:6px 0 18px"><tr><td align="center" style="padding:18px">
<div style="font-size:12px;letter-spacing:2px;color:#a51d27">YOUR FLAG USERNAME</div>
<div style="font-family:'Courier New',Courier,monospace;font-size:28px;font-weight:bold;color:#c8102e;margin-top:6px">${esc(w.username)}</div>
</td></tr></table>
<p style="margin:0 0 8px;line-height:1.6">⛪ <b>Every Sunday:</b> scan the QR code on the screen and type <b>${esc(w.username)}</b> to check in.</p>
<p style="margin:0 0 20px;line-height:1.6">📱 <b>Your membership dashboard:</b> sign in with ${esc(signIn)}.</p>
${w.hasPassword
    ? `<p style="margin:0 0 20px;line-height:1.6;color:#444">You already have a password, so you can also sign in with your username and password.</p>`
    : `<div style="background:#faf8f7;border-radius:14px;padding:18px;margin:0 0 18px"><p style="margin:0 0 12px;line-height:1.6"><b>Would you love to sign in with a password?</b> It&rsquo;s optional &mdash; set one for your membership dashboard:</p>${button(w.setPasswordUrl, "Set my password")}<p style="margin:10px 0 0;font-size:12px;color:#888">This link works for 30 days.</p></div>`}
<p style="margin:0 0 22px">${button(w.dashboardUrl, "Open my dashboard", w.hasPassword)}</p>
${programs.length ? `<p style="margin:0 0 6px;font-weight:bold">Join us</p><ul style="margin:0 0 18px;padding-left:18px;line-height:1.7;color:#444">${programs.map((p) => `<li><b>${esc(p.name)}</b>${p.when ? ` &mdash; ${esc(p.when)}` : ""}</li>`).join("")}</ul>` : ""}
<p style="margin:0;line-height:1.6">With love,<br><b>The FlagUpJesus family</b></p>`);
  return { subject, text, html };
}

export function passwordResetEmail(r: { firstName: string; username: string; url: string }, church: Church) {
  const subject = "Set a new password for your FlagUpJesus dashboard";
  const text = `Hi ${r.firstName},\n\nSomeone (hopefully you) asked to set a new password for ${r.username}. Set it here — the link works for 2 hours:\n${r.url}\n\nIf it wasn't you, you can ignore this email; nothing changes.\n\nThe FlagUpJesus family`;
  const html = frame(church, `
<h1 style="margin:0 0 12px;font-size:22px">Set a new password</h1>
<p style="margin:0 0 16px;line-height:1.6">Hi ${esc(r.firstName)}, someone (hopefully you) asked to set a new password for <b style="font-family:'Courier New',monospace;color:#c8102e">${esc(r.username)}</b>.</p>
<p style="margin:0 0 16px">${button(r.url, "Set a new password")}</p>
<p style="margin:0;font-size:13px;color:#777;line-height:1.6">The link works for 2 hours. If it wasn&rsquo;t you, ignore this email &mdash; nothing changes.</p>`);
  return { subject, text, html };
}
