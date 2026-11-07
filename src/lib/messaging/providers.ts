import "server-only";

/**
 * Outbound adapters. In-app delivery always works; WhatsApp, SMS and email are only attempted
 * when their provider is configured. No secrets are logged.
 *
 * WhatsApp: Meta WhatsApp Business Cloud API (works for numbers on WhatsApp and WhatsApp Business).
 * SMS: Termii (Nigeria-focused). Both are plain HTTPS calls, easy to swap for another provider.
 */
export const providers = {
  get sms() { return Boolean(process.env.TERMII_API_KEY && process.env.TERMII_SENDER_ID); },
  get email() { return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM); },
  get whatsapp() { return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID); },
  get whatsappTemplate() { return process.env.WHATSAPP_TEMPLATE_NAME || null; }
};

export type SendResult = "sent" | "failed" | "skipped";

/** A send attempt plus the provider's own explanation when it fails (shown by the Settings test button). */
export type Attempt = { status: SendResult; detail?: string };
const errorText = (json: unknown) => {
  const j = json as { message?: unknown; error?: unknown; name?: unknown } | null;
  const v = j?.message ?? (typeof j?.error === "string" ? j.error : (j?.error as { message?: unknown } | undefined)?.message) ?? j?.name;
  return typeof v === "string" ? v.slice(0, 200) : undefined;
};

export async function smsAttempt(to: string, text: string): Promise<Attempt> {
  if (!providers.sms) return { status: "skipped", detail: "SMS isn't set up (TERMII_API_KEY / TERMII_SENDER_ID)." };
  try {
    const res = await fetch(`${(process.env.TERMII_BASE_URL || "https://api.ng.termii.com").replace(/\/+$/, "")}/api/sms/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: to.replace(/^\+/, ""), from: process.env.TERMII_SENDER_ID, sms: text.slice(0, 640), type: "plain",
        // "dnd" reaches Nigerian numbers on Do-Not-Disturb (needs activation on Termii); "generic" otherwise.
        channel: process.env.TERMII_CHANNEL ?? "generic", api_key: process.env.TERMII_API_KEY
      })
    });
    if (res.ok) return { status: "sent" };
    return { status: "failed", detail: errorText(await res.json().catch(() => null)) ?? `Termii returned HTTP ${res.status}` };
  } catch {
    return { status: "failed", detail: "Couldn't reach Termii." };
  }
}
export async function sendSms(to: string, text: string): Promise<SendResult> {
  return (await smsAttempt(to, text)).status;
}

export async function emailAttempt(to: string, subject: string, text: string, extra: { html?: string; replyTo?: string | null } = {}): Promise<Attempt> {
  if (!providers.email) return { status: "skipped", detail: "Email isn't set up (RESEND_API_KEY / EMAIL_FROM)." };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text, ...(extra.html ? { html: extra.html } : {}), ...(extra.replyTo ? { reply_to: extra.replyTo } : {}) })
    });
    if (res.ok) return { status: "sent" };
    return { status: "failed", detail: errorText(await res.json().catch(() => null)) ?? `Resend returned HTTP ${res.status}` };
  } catch {
    return { status: "failed", detail: "Couldn't reach Resend." };
  }
}
export async function sendEmail(to: string, subject: string, text: string, extra: { html?: string; replyTo?: string | null } = {}): Promise<SendResult> {
  return (await emailAttempt(to, subject, text, extra)).status;
}

/** WhatsApp template parameters may not contain newlines, tabs or 4+ consecutive spaces. */
export function templateSafe(text: string, max = 1000) {
  return text.replace(/[\r\n\t]+/g, " · ").replace(/ {4,}/g, "   ").trim().slice(0, max);
}

export type WhatsAppResult = { status: SendResult; id?: string; errorCode?: number; detail?: string };

/**
 * Sends a broadcast over WhatsApp. Outside the 24-hour customer-service window Meta only delivers
 * approved *template* messages, so when WHATSAPP_TEMPLATE_NAME is set we send that template with
 * {{1}} = title and {{2}} = message. Without a template a free-form text message is sent, which only
 * reaches people who messaged the church number in the last 24 hours (failures fall back to SMS).
 * Delivery to numbers that are not on WhatsApp fails asynchronously (webhook error 131026).
 */
export async function sendWhatsApp(to: string, title: string, body: string, imageUrl?: string | null): Promise<WhatsAppResult> {
  if (!providers.whatsapp) return { status: "skipped" };
  const recipient = to.replace(/^\+/, "");
  const lang = { code: process.env.WHATSAPP_TEMPLATE_LANG ?? "en" };
  const bodyParams = (extra = "") => [{ type: "text", text: templateSafe(title, 60) }, { type: "text", text: templateSafe(body + extra) }];
  const flyerTemplate = process.env.WHATSAPP_FLYER_TEMPLATE_NAME;
  const template = providers.whatsappTemplate;
  let payload: Record<string, unknown>;
  if (imageUrl && flyerTemplate) {
    // Approved template with an IMAGE header: the flyer arrives as a picture with the message under it.
    payload = { messaging_product: "whatsapp", to: recipient, type: "template", template: { name: flyerTemplate, language: lang, components: [
      { type: "header", parameters: [{ type: "image", image: { link: imageUrl } }] }, { type: "body", parameters: bodyParams() }] } };
  } else if (template) {
    payload = { messaging_product: "whatsapp", to: recipient, type: "template", template: { name: template, language: lang, components: [
      { type: "body", parameters: bodyParams(imageUrl ? ` · Flyer: ${imageUrl}` : "") }] } };
  } else if (imageUrl) {
    payload = { messaging_product: "whatsapp", to: recipient, type: "image", image: { link: imageUrl, caption: `*${title}*\n\n${body}`.slice(0, 1024) } };
  } else {
    payload = { messaging_product: "whatsapp", to: recipient, type: "text", text: { preview_url: true, body: `*${title}*\n\n${body}`.slice(0, 4096) } };
  }
  try {
    const res = await fetch(`https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION ?? "v21.0"}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
      body: JSON.stringify(payload)
    });
    const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { code?: number; message?: string; error_data?: { details?: string } } };
    if (res.ok && json.messages?.[0]?.id) return { status: "sent", id: json.messages[0].id };
    return { status: "failed", errorCode: json.error?.code, detail: (json.error?.error_data?.details ?? json.error?.message)?.slice(0, 200) };
  } catch {
    return { status: "failed", detail: "Couldn't reach WhatsApp (graph.facebook.com)." };
  }
}

/** WhatsApp error codes meaning "this number cannot receive WhatsApp messages". */
export const NOT_ON_WHATSAPP_CODES = new Set([131026]);

/** Plain-English fixes for the WhatsApp Cloud API errors people hit while setting up. */
export const WHATSAPP_ERROR_HINTS: Record<number, string> = {
  190: "The access token is invalid or expired — create a permanent System User token and update WHATSAPP_TOKEN.",
  100: "Meta rejected a setting — check WHATSAPP_PHONE_NUMBER_ID (the Phone number ID, not the phone number itself).",
  131030: "This number isn't on your test recipient list — add it under WhatsApp → API Setup → To, or add a real business number.",
  131026: "This number isn't on WhatsApp (they'll get SMS instead when SMS is set up).",
  131047: "More than 24 hours since this person messaged the church number — set an approved template in WHATSAPP_TEMPLATE_NAME.",
  132001: "The template name or language wasn't found — check WHATSAPP_TEMPLATE_NAME / WHATSAPP_TEMPLATE_LANG and that it's approved.",
  132000: "The template's number of {{variables}} doesn't match — the broadcast template needs exactly {{1}} (title) and {{2}} (message).",
  131056: "Too many messages to this number in a short time — wait a minute and try again."
};
