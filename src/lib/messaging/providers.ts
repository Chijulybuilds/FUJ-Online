import "server-only";
import { runtimeEnv } from "@/lib/env";

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
  get whatsapp() { return Boolean(wa.token && wa.phoneId); },
  get whatsappTemplate() { return wa.template || null; }
};

/** WhatsApp settings, forgiving about stray spaces / quotes / a pasted "Bearer " in the dashboard. */
const wa = {
  get token() { return runtimeEnv("WHATSAPP_TOKEN").replace(/^Bearer\s+/i, ""); },
  get phoneId() { return runtimeEnv("WHATSAPP_PHONE_NUMBER_ID"); },
  get template() { return runtimeEnv("WHATSAPP_TEMPLATE_NAME"); },
  get flyerTemplate() { return runtimeEnv("WHATSAPP_FLYER_TEMPLATE_NAME"); },
  get lang() { return runtimeEnv("WHATSAPP_TEMPLATE_LANG") || "en"; },
  get base() { return `https://graph.facebook.com/${runtimeEnv("WHATSAPP_API_VERSION") || "v21.0"}`; }
};

/** Free mailbox providers: nobody can send through Resend "from" these, only from a domain they've verified. */
const PUBLIC_MAILBOXES = /@(gmail|googlemail|yahoo|ymail|outlook|hotmail|live|msn|icloud|me|aol|proton|protonmail)\.[a-z.]+>?\s*$/i;

/** Why EMAIL_FROM can't work, in plain English (null when it looks fine or isn't set). */
export function emailFromProblem(from = process.env.EMAIL_FROM ?? ""): string | null {
  const value = from.trim();
  if (!value) return null;
  if (!/@/.test(value)) return "EMAIL_FROM should look like: FlagUpJesus <news@flagupjesus.org>";
  if (PUBLIC_MAILBOXES.test(value)) return "EMAIL_FROM can't be a Gmail/Yahoo/Outlook address — use an address at your verified domain, e.g. FlagUpJesus <news@flagupjesus.org> (replies still go to the church Gmail)";
  return null;
}

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
    const res = await fetch(`${(process.env.RESEND_BASE_URL || "https://api.resend.com").replace(/\/+$/, "")}/emails`, {
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
type MetaError = { code?: number; message?: string; error_subcode?: number; error_data?: { details?: string } };

/** English templates are often approved as "English (US)" (en_US) or "English (UK)" (en_GB) rather than "en". */
const ENGLISH = ["en", "en_US", "en_GB"];
/** The language code that last worked for each template, so later messages in a broadcast go straight through. */
const workingLanguage = new Map<string, string>();
function languagesFor(template: string) {
  const first = workingLanguage.get(template) ?? wa.lang;
  return [first, ...(/^en(_|$)/i.test(first) ? ENGLISH.filter((c) => c !== first) : [])];
}

async function postMessage(payload: Record<string, unknown>): Promise<WhatsAppResult> {
  try {
    const res = await fetch(`${wa.base}/${wa.phoneId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${wa.token}` },
      body: JSON.stringify(payload)
    });
    const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: MetaError };
    if (res.ok && json.messages?.[0]?.id) return { status: "sent", id: json.messages[0].id };
    return { status: "failed", errorCode: json.error?.code, detail: (json.error?.error_data?.details || json.error?.message || `WhatsApp returned HTTP ${res.status}`).slice(0, 300) };
  } catch {
    return { status: "failed", detail: "Couldn't reach WhatsApp (graph.facebook.com)." };
  }
}

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
  const bodyParams = (extra = "") => [{ type: "text", text: templateSafe(title, 60) }, { type: "text", text: templateSafe(body + extra) }];
  const flyerTemplate = wa.flyerTemplate;
  const template = providers.whatsappTemplate;
  const withTemplate = (name: string, components: unknown[]) => async () => {
    let first: WhatsAppResult | null = null;
    for (const code of languagesFor(name)) {
      const r = await postMessage({ messaging_product: "whatsapp", to: recipient, type: "template", template: { name, language: { code }, components } });
      if (r.status === "sent") { workingLanguage.set(name, code); return r; }
      first ??= r;
      if (r.errorCode !== 132001) return r; // only "template not found in this language" is worth retrying
    }
    const tried = languagesFor(name);
    return { ...first!, detail: `${first!.detail ?? ""} (tried language codes ${tried.join(", ")})`.trim().slice(0, 300) };
  };
  if (imageUrl && flyerTemplate) {
    // Approved template with an IMAGE header: the flyer arrives as a picture with the message under it.
    return withTemplate(flyerTemplate, [{ type: "header", parameters: [{ type: "image", image: { link: imageUrl } }] }, { type: "body", parameters: bodyParams() }])();
  }
  if (template) return withTemplate(template, [{ type: "body", parameters: bodyParams(imageUrl ? ` · Flyer: ${imageUrl}` : "") }])();
  if (imageUrl) return postMessage({ messaging_product: "whatsapp", to: recipient, type: "image", image: { link: imageUrl, caption: `*${title}*\n\n${body}`.slice(0, 1024) } });
  return postMessage({ messaging_product: "whatsapp", to: recipient, type: "text", text: { preview_url: true, body: `*${title}*\n\n${body}`.slice(0, 4096) } });
}

/** WhatsApp error codes meaning "this number cannot receive WhatsApp messages". */
export const NOT_ON_WHATSAPP_CODES = new Set([131026]);

/** Plain-English fixes for the WhatsApp Cloud API errors people hit while setting up (codes from Meta's error reference). */
export const WHATSAPP_ERROR_HINTS: Record<number, string> = {
  0: "Meta couldn't sign in with WHATSAPP_TOKEN — create a permanent System User token and update it in Vercel.",
  190: "The access token is invalid or expired (the one on the API Setup page only lasts 24 hours) — create a permanent System User token and update WHATSAPP_TOKEN.",
  10: "The token doesn't have WhatsApp permission — generate the System User token with whatsapp_business_messaging and whatsapp_business_management, and assign it the WhatsApp account.",
  200: "Meta won't let this token use the WhatsApp API — generate a System User token with whatsapp_business_messaging and whatsapp_business_management and assign it both the app and the WhatsApp account; if Meta says “API access blocked”, the Meta app or account itself is restricted (see developers.facebook.com/apps).",
  100: "Meta rejected part of the request — usually WHATSAPP_PHONE_NUMBER_ID (it must be the long Phone number ID, not the phone number) or a template that doesn't use numbered variables {{1}} and {{2}}.",
  131000: "Meta had a temporary problem — try again in a few minutes.",
  131005: "Access denied — the token's System User needs the WhatsApp account assigned with full control.",
  131008: "The template expects something the app didn't send (often a header image or extra variables) — fuj_broadcast should have no header and exactly {{1}} and {{2}} in the body.",
  131009: "The template expects something the app didn't send (often a header image or extra variables) — fuj_broadcast should have no header and exactly {{1}} and {{2}} in the body.",
  131021: "You can't send a WhatsApp from the church number to the church number itself — test with a different phone.",
  131026: "This number isn't on WhatsApp, or hasn't accepted WhatsApp's latest terms (they'll get SMS instead when SMS is set up).",
  131030: "You're on Meta's test number, which only reaches numbers on its allowed list — add this number under WhatsApp → API Setup → “To” (Manage phone number list), or connect the church's real number.",
  131031: "The WhatsApp Business account is locked by Meta — check WhatsApp Manager → Account quality.",
  131037: "The church number's display name hasn't been approved yet — check WhatsApp Manager → Phone numbers (approval can take a day or two).",
  131042: "Payment problem — add a valid payment method in WhatsApp Manager → Payment settings (Meta charges per template message).",
  131045: "The church number isn't registered for the Cloud API yet — finish adding it under WhatsApp → API Setup (verify the code and set a PIN).",
  131047: "More than 24 hours since this person messaged the church number — set an approved template in WHATSAPP_TEMPLATE_NAME.",
  131048: "Meta is limiting messages because people blocked or reported recent ones — slow down and check WhatsApp Manager → Account quality.",
  131049: "Meta chose not to deliver this marketing message (it limits how many marketing messages each person gets). Use a Utility template for notices and reminders, or try again later.",
  131050: "This person has turned off marketing messages from businesses on WhatsApp.",
  131051: "WhatsApp doesn't support this kind of message.",
  131056: "Too many messages to this number in a short time — wait a minute and try again.",
  131057: "The WhatsApp Business account is in maintenance — try again in a few minutes.",
  132000: "The template's variables don't match — fuj_broadcast needs exactly two: {{1}} (title) and {{2}} (message).",
  132001: "The template wasn't found — check it's approved in WhatsApp Manager → Message templates, that WHATSAPP_TEMPLATE_NAME matches its name exactly, and that WHATSAPP_TEMPLATE_LANG matches its language code (en, en_US or en_GB are tried automatically).",
  132005: "The message is too long for the template — shorten it.",
  132007: "The message breaks WhatsApp's template content rules — remove unusual formatting and try again.",
  132012: "The template's variables are a different type from what the app sends — fuj_broadcast should use numbered text variables {{1}} and {{2}} and no header.",
  132015: "The template is paused by Meta because of low quality — edit or recreate it in WhatsApp Manager.",
  132016: "The template is disabled by Meta — create a new one and update WHATSAPP_TEMPLATE_NAME.",
  133010: "The church number isn't registered for the Cloud API yet — finish adding it under WhatsApp → API Setup (verify the code and set a PIN).",
  368: "Meta has temporarily restricted this WhatsApp account for policy reasons — check WhatsApp Manager → Account quality.",
  130429: "Sending too fast for the account's limit — wait a moment and try again.",
  80007: "Sending too fast for the account's limit — wait a moment and try again."
};

/** Meta's "(#200) API access blocked": the Meta app, business or developer account behind the token is restricted. */
export const ACCESS_BLOCKED_HINT = "Meta is blocking API access for the Meta app or account behind this token (not the number or template). Fix any red/yellow notice on developers.facebook.com/apps → your app (restricted app, Data Use Checkup, verify account), check business.facebook.com → Account quality, then make a fresh System User token with the app AND the WhatsApp account assigned.";

/** One plain-English line explaining a WhatsApp failure: the fix (when known) plus Meta's own words. */
export function whatsappReason(errorCode?: number | null, detail?: string | null): string {
  const hint = /access blocked/i.test(detail ?? "") ? ACCESS_BLOCKED_HINT : errorCode != null ? WHATSAPP_ERROR_HINTS[errorCode] : undefined;
  const meta = detail?.trim();
  const text = hint ? `${hint}${meta && !hint.includes(meta) ? ` (Meta: “${meta}”)` : ""}` : meta || "WhatsApp didn't say why.";
  return `${errorCode != null ? `Error ${errorCode}: ` : ""}${text}`.slice(0, 700);
}

/* ------------------------------------------------------------------ setup check */
export type CheckLine = { ok: boolean | null; text: string };
type Health = { can_send_message?: string; entities?: { id?: string; entity_type?: string; can_send_message?: string; additional_info?: string[]; errors?: { error_code?: number; error_description?: string; possible_solution?: string }[] }[] };
type PhoneInfo = { display_phone_number?: string; verified_name?: string; name_status?: string; code_verification_status?: string; quality_rating?: string; platform_type?: string; account_mode?: string; status?: string; health_status?: Health; error?: MetaError };
type TokenInfo = { data?: { is_valid?: boolean; application?: string; app_id?: string; type?: string; expires_at?: number; scopes?: string[]; granular_scopes?: { scope?: string; target_ids?: string[] }[]; error?: { message?: string } } };
type TemplateInfo = { name?: string; status?: string; language?: string; category?: string; parameter_format?: string; rejected_reason?: string; components?: { type?: string; format?: string; text?: string }[] };

async function graphGet<T>(path: string): Promise<T & { error?: MetaError }> {
  try {
    const res = await fetch(`${wa.base}/${path}`, { headers: { Authorization: `Bearer ${wa.token}` } });
    return (await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }))) as T & { error?: MetaError };
  } catch {
    return { error: { message: "Couldn't reach WhatsApp (graph.facebook.com)." } } as T & { error?: MetaError };
  }
}
/** Asks for the given fields, dropping the optional ones if this API version doesn't know them. */
async function getWithFallback<T>(node: string, fieldSets: string[], query = ""): Promise<T & { error?: MetaError }> {
  let last = {} as T & { error?: MetaError };
  for (const fields of fieldSets) {
    last = await graphGet<T>(`${node}?fields=${fields}${query}`);
    if (!last.error || last.error.code !== 100 || !/field/i.test(last.error.message ?? "")) return last;
  }
  return last;
}

const WHATSAPP_SCOPES = ["whatsapp_business_messaging", "whatsapp_business_management"];
/** What Meta says about WHATSAPP_TOKEN itself; returns the WhatsApp account IDs the token may message from. */
async function describeToken(add: (ok: boolean | null, text: string) => void, phoneFailed: boolean): Promise<string[]> {
  const t = await graphGet<TokenInfo>(`debug_token?input_token=${encodeURIComponent(wa.token)}`);
  if (t.error) {
    if (phoneFailed && t.error.code != null) add(false, /access blocked/i.test(t.error.message ?? "") || t.error.code === 200
      ? "Meta won't even describe the token, so the block is on the Meta app or account itself — see the fix above."
      : `Meta couldn't read the token (${whatsappReason(t.error.code, t.error.message)}).`);
    return [];
  }
  const d = t.data;
  if (!d) return [];
  if (d.is_valid === false) { add(false, `WHATSAPP_TOKEN isn't valid any more${d.error?.message ? ` (Meta: “${d.error.message}”)` : ""} — create a new System User token and update it in Vercel.`); return []; }
  const kind = d.type === "SYSTEM_USER" ? "System User token" : d.type === "USER" ? "personal (user) token" : "token";
  const expires = d.expires_at ? new Date(d.expires_at * 1000) : null;
  if (phoneFailed || expires || d.type === "USER") add(expires || d.type === "USER" ? null : true, `WHATSAPP_TOKEN is a ${kind} for the Meta app “${d.application ?? d.app_id ?? "?"}”${expires ? `, expiring ${expires.toUTCString().slice(5, 22)} UTC — replace it with a permanent System User token (expiry: Never) before then` : ""}.`);
  const missing = WHATSAPP_SCOPES.filter((s) => !(d.scopes ?? []).includes(s));
  if (missing.length) add(false, `The token is missing the ${missing.join(" and ")} permission${missing.length > 1 ? "s" : ""} — generate a new System User token and tick ${missing.join(" and ")}.`);
  const targets = d.granular_scopes?.find((g) => g.scope === "whatsapp_business_messaging")?.target_ids ?? [];
  if (phoneFailed && targets.length) add(null, `The token may only use WhatsApp account ID${targets.length > 1 ? "s" : ""} ${targets.join(", ")} — check WHATSAPP_PHONE_NUMBER_ID is a number in ${targets.length > 1 ? "one of those accounts" : "that account"} (WhatsApp Manager → Phone numbers).`);
  return targets;
}

/**
 * Settings → "Check WhatsApp setup": reads (sends nothing) the church number, Meta's own health check of the number,
 * WhatsApp account, business and app, and the broadcast template, then lists what's fine and what to fix.
 */
export async function checkWhatsAppSetup(): Promise<{ ok: boolean; lines: CheckLine[] }> {
  const lines: CheckLine[] = [];
  const add = (ok: boolean | null, text: string) => lines.push({ ok, text });
  if (!providers.whatsapp) return { ok: false, lines: [{ ok: false, text: "WhatsApp isn't set up: add WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID in Vercel, then redeploy." }] };
  if (!/^\d{10,20}$/.test(wa.phoneId)) add(false, "WHATSAPP_PHONE_NUMBER_ID should be the long Phone number ID from WhatsApp → API Setup, not the phone number itself.");
  const phone = await getWithFallback<PhoneInfo>(wa.phoneId, [
    "display_phone_number,verified_name,name_status,code_verification_status,quality_rating,platform_type,account_mode,status,health_status",
    "display_phone_number,verified_name,quality_rating,health_status",
    "display_phone_number,verified_name"
  ]);
  if (phone.error) {
    if (phone.error.code == null) { add(null, "Couldn't reach Meta's WhatsApp API (graph.facebook.com) from the server — try again in a minute."); return { ok: false, lines }; }
    add(false, `Meta refused the token / Phone number ID — ${whatsappReason(phone.error.code, phone.error.error_data?.details ?? phone.error.message)}`);
    await describeToken(add, true);
    return { ok: false, lines };
  }
  add(true, `Token and Phone number ID work: sending from ${phone.display_phone_number ?? "?"}${phone.verified_name ? ` (“${phone.verified_name}”)` : ""}.`);
  await describeToken(add, false);
  if (phone.account_mode === "SANDBOX" || /^\+?1\s?555/.test(phone.display_phone_number ?? "")) {
    add(false, "This is Meta's free TEST number: it can only message the (up to 5) numbers added under WhatsApp → API Setup → “To”. Add your number there to test, and connect the church's real number to reach members.");
  }
  if (phone.platform_type && phone.platform_type !== "CLOUD_API") add(false, `The number isn't registered for the Cloud API yet (platform: ${phone.platform_type}) — finish adding it under WhatsApp → API Setup (verify the code and set a PIN).`);
  if (phone.status && !["CONNECTED", "FLAGGED"].includes(phone.status)) add(false, `The number's status is ${phone.status} (it should be CONNECTED) — check WhatsApp Manager → Phone numbers.`);
  if (phone.name_status && !["APPROVED", "AVAILABLE_WITHOUT_REVIEW"].includes(phone.name_status)) add(phone.name_status === "PENDING_REVIEW" ? null : false, `Display name status: ${phone.name_status} — messages may fail until Meta approves the name (WhatsApp Manager → Phone numbers).`);
  if (phone.quality_rating && phone.quality_rating !== "GREEN" && phone.quality_rating !== "UNKNOWN") add(null, `Quality rating is ${phone.quality_rating} — people have been blocking or reporting messages; send less often and make them more relevant.`);
  const health = phone.health_status;
  if (health?.can_send_message) {
    if (health.can_send_message === "AVAILABLE") add(true, "Meta's health check: the number, WhatsApp account, business and app can all send messages.");
    for (const e of health.entities ?? []) {
      const who = ({ PHONE_NUMBER: "Phone number", WABA: "WhatsApp Business account", BUSINESS: "Meta business", APP: "Meta app", MESSAGE_TEMPLATE: "Template" } as Record<string, string>)[e.entity_type ?? ""] ?? e.entity_type;
      for (const err of e.errors ?? []) add(false, `${who} is blocked${err.error_code ? ` (error ${err.error_code})` : ""}: ${err.error_description ?? "no reason given"}${err.possible_solution ? ` — Fix: ${err.possible_solution}` : ""}`);
      if (e.can_send_message === "LIMITED") add(null, `${who} is limited${e.additional_info?.length ? `: ${e.additional_info.join(" ")}` : "."}`);
      if (e.can_send_message === "BLOCKED" && !e.errors?.length) add(false, `${who} is blocked from sending — check WhatsApp Manager for details.`);
    }
  }
  // The broadcast template(s), read from the WhatsApp Business account the health check names.
  const wabaId = health?.entities?.find((e) => e.entity_type === "WABA")?.id;
  const names = [wa.template, wa.flyerTemplate].filter(Boolean);
  if (!wa.template) add(false, "WHATSAPP_TEMPLATE_NAME isn't set — without an approved template WhatsApp only reaches people who messaged the church number in the last 24 hours.");
  for (const name of names) {
    if (!wabaId) { add(null, `Couldn't look up the template “${name}” from here — check it's Approved in WhatsApp Manager → Message templates, then use “Send test” below.`); break; }
    const list = await getWithFallback<{ data?: TemplateInfo[] }>(`${wabaId}/message_templates`, ["name,status,language,category,parameter_format,rejected_reason,components", "name,status,language,category,components"], `&name=${encodeURIComponent(name)}&limit=50`);
    if (list.error) { add(null, `Couldn't read the templates (${whatsappReason(list.error.code, list.error.message)}). The token may lack whatsapp_business_management.`); break; }
    const found = (list.data ?? []).filter((t) => t.name === name);
    if (!found.length) { add(false, `No template called “${name}” in this WhatsApp account — create it in WhatsApp Manager → Message templates, or correct ${name === wa.template ? "WHATSAPP_TEMPLATE_NAME" : "WHATSAPP_FLYER_TEMPLATE_NAME"} (lower-case, exactly as Meta shows it).`); continue; }
    const approved = found.filter((t) => t.status === "APPROVED");
    for (const t of found.filter((x) => x.status !== "APPROVED")) add(t.status === "PENDING" ? null : false, `Template “${name}” (${t.language}) is ${t.status}${t.rejected_reason && t.rejected_reason !== "NONE" ? ` (${t.rejected_reason})` : ""}${t.status === "PENDING" ? " — wait for Meta's approval (minutes to a day)." : " — edit and resubmit it, or create a new one."}`);
    if (!approved.length) continue;
    const langs = approved.map((t) => t.language ?? "?");
    const usable = languagesFor(name);
    const lang = langs.find((l) => usable.includes(l));
    if (lang) add(true, `Template “${name}” is approved (${langs.join(", ")}, ${approved[0].category?.toLowerCase() ?? "?"}).`);
    else add(false, `Template “${name}” is approved in ${langs.join(", ")}, but the app sends ${usable.join(" / ")} — set WHATSAPP_TEMPLATE_LANG=${langs[0]} in Vercel and redeploy.`);
    const t = approved.find((x) => x.language === lang) ?? approved[0];
    const body = t.components?.find((c) => c.type === "BODY")?.text ?? "";
    const vars = [...new Set([...body.matchAll(/\{\{\s*([^}\s]+)\s*\}\}/g)].map((m) => m[1]))];
    const header = t.components?.find((c) => c.type === "HEADER");
    if (t.parameter_format === "NAMED" || vars.some((v) => !/^\d+$/.test(v))) add(false, `Template “${name}” uses named variables (${vars.map((v) => `{{${v}}}`).join(", ")}). The app fills numbered ones — recreate it with {{1}} for the title and {{2}} for the message.`);
    else if (vars.length !== 2) add(false, `Template “${name}” has ${vars.length} variable${vars.length === 1 ? "" : "s"} in its body; it needs exactly two: {{1}} (title) and {{2}} (message).`);
    const isFlyer = name === wa.flyerTemplate && name !== wa.template;
    if (isFlyer && header?.format !== "IMAGE") add(false, `Flyer template “${name}” needs an Image header.`);
    if (!isFlyer && header && (header.format !== "TEXT" || /\{\{/.test(header.text ?? ""))) add(false, `Template “${name}” has a ${header.format?.toLowerCase() ?? ""} header the app doesn't fill — remove the header (use WHATSAPP_FLYER_TEMPLATE_NAME for a picture template).`);
  }
  if (!lines.some((l) => l.ok === false)) add(true, "Everything Meta reports looks right. Use “Send test” below to send yourself a real message.");
  return { ok: !lines.some((l) => l.ok === false), lines };
}
