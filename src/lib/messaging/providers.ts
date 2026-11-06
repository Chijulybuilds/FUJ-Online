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

export async function sendSms(to: string, text: string): Promise<SendResult> {
  if (!providers.sms) return "skipped";
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
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

export async function sendEmail(to: string, subject: string, text: string): Promise<SendResult> {
  if (!providers.email) return "skipped";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text })
    });
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

/** WhatsApp template parameters may not contain newlines, tabs or 4+ consecutive spaces. */
export function templateSafe(text: string, max = 1000) {
  return text.replace(/[\r\n\t]+/g, " · ").replace(/ {4,}/g, "   ").trim().slice(0, max);
}

export type WhatsAppResult = { status: SendResult; id?: string; errorCode?: number };

/**
 * Sends a broadcast over WhatsApp. Outside the 24-hour customer-service window Meta only delivers
 * approved *template* messages, so when WHATSAPP_TEMPLATE_NAME is set we send that template with
 * {{1}} = title and {{2}} = message. Without a template a free-form text message is sent, which only
 * reaches people who messaged the church number in the last 24 hours (failures fall back to SMS).
 * Delivery to numbers that are not on WhatsApp fails asynchronously (webhook error 131026).
 */
export async function sendWhatsApp(to: string, title: string, body: string): Promise<WhatsAppResult> {
  if (!providers.whatsapp) return { status: "skipped" };
  const template = providers.whatsappTemplate;
  const payload = template
    ? {
        messaging_product: "whatsapp", to: to.replace(/^\+/, ""), type: "template",
        template: {
          name: template, language: { code: process.env.WHATSAPP_TEMPLATE_LANG ?? "en" },
          components: [{ type: "body", parameters: [{ type: "text", text: templateSafe(title, 60) }, { type: "text", text: templateSafe(body) }] }]
        }
      }
    : { messaging_product: "whatsapp", to: to.replace(/^\+/, ""), type: "text", text: { preview_url: true, body: `*${title}*\n\n${body}`.slice(0, 4096) } };
  try {
    const res = await fetch(`https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION ?? "v21.0"}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
      body: JSON.stringify(payload)
    });
    const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { code?: number } };
    if (res.ok && json.messages?.[0]?.id) return { status: "sent", id: json.messages[0].id };
    return { status: "failed", errorCode: json.error?.code };
  } catch {
    return { status: "failed" };
  }
}

/** WhatsApp error codes meaning "this number cannot receive WhatsApp messages". */
export const NOT_ON_WHATSAPP_CODES = new Set([131026]);
