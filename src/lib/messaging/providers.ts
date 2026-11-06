import "server-only";

/**
 * Provider-neutral outbound adapters. In-app delivery always works; SMS and email are only
 * attempted when the provider is configured. No secrets are logged.
 */
export const providers = {
  get sms() { return Boolean(process.env.TERMII_API_KEY && process.env.TERMII_SENDER_ID); },
  get email() { return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM); }
};

export async function sendSms(to: string, text: string): Promise<"sent" | "failed" | "skipped"> {
  if (!providers.sms) return "skipped";
  try {
    const res = await fetch(`${process.env.TERMII_BASE_URL ?? "https://api.ng.termii.com"}/api/sms/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: to.replace(/^\+/, ""), from: process.env.TERMII_SENDER_ID, sms: text.slice(0, 640), type: "plain", channel: "generic", api_key: process.env.TERMII_API_KEY })
    });
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

export async function sendEmail(to: string, subject: string, text: string): Promise<"sent" | "failed" | "skipped"> {
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
