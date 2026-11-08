import { PageHeading } from "@/components/ui/page-heading";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { requireAdmin } from "@/lib/auth/session";
import { can, ROLE_LABELS } from "@/lib/auth/roles";
import { getSettings } from "@/lib/repo/settings";
import { addStaffAction, saveFirstTimerPartnerSettingsAction, saveFollowUpSettingsAction, saveSettingsAction, sendTestMessageAction, sendWelcomeBacklogAction, toggleStaffAction } from "@/lib/actions/admin";
import { WELCOME_BATCH, welcomeStats } from "@/lib/repo/accounts";
import { DEFAULT_FIRST_MESSAGE, DEFAULT_REMINDER_MESSAGE } from "@/lib/repo/auto-follow-up";
import { DEFAULT_INVITE_MESSAGE, DEFAULT_WELCOME_MESSAGE } from "@/lib/repo/first-timers";
import { DEFAULT_REMINDER_MESSAGE as DEFAULT_PARTNER_REMINDER, DEFAULT_THANKS_MESSAGE } from "@/lib/repo/partners";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { emailFromProblem, providers } from "@/lib/messaging/providers";
import { formatDate } from "@/lib/utils";

// "Send welcome emails now" sends a paced batch, which can take up to ~40 seconds.
export const maxDuration = 60;

export default async function SettingsPage() {
  const admin = await requireAdmin("settings");
  const [s, staff, welcome] = await Promise.all([getSettings(), can(admin.role, "staff") ? db().list("admin_users", { order: { column: "created_at" } }) : Promise.resolve([]), welcomeStats().catch(() => null)]);
  const integrations = [
    ["Database", env.useSupabaseData ? "Supabase (service role)" : "Local JSON file (development)", env.useSupabaseData],
    ["Google sign-in", env.googleEnabled ? "Configured" : "Add CLIENT_ID / CLIENT_SECRET", env.googleEnabled],
    ["Shared admin login", env.sharedAdmin ? env.sharedAdmin.email : "Set ADMIN_LOGIN_EMAIL / PASSWORD", Boolean(env.sharedAdmin)],
    ["Registration", env.registrationOtp ? "SMS OTP required" : "Free — everyone is a member from sign-up", true],
    ["WhatsApp sharing", "Free — Share on WhatsApp button", true],
    ["WhatsApp (Cloud API, automatic)", providers.whatsapp ? (providers.whatsappTemplate ? "Configured · template" : "Configured · no template (24h window only)") : "Not configured", providers.whatsapp],
    ["SMS (Termii) — OTP & fallback", providers.sms ? "Configured" : "Not configured", providers.sms],
    ["Email (Resend)", providers.email ? "Configured" : "Not configured", providers.email]
  ] as const;
  const cronReady = Boolean(process.env.CRON_SECRET) || process.env.NODE_ENV !== "production";
  const channels = [
    ["WhatsApp", providers.whatsapp, providers.whatsapp ? (providers.whatsappTemplate ? `Template “${providers.whatsappTemplate}” · reaches everyone` : "No template yet — only reaches people who messaged the church number in the last 24h") : "Meta WhatsApp Cloud API: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TEMPLATE_NAME", "whatsapp"],
    ["SMS", providers.sms, providers.sms ? `Termii · sender “${process.env.TERMII_SENDER_ID}”` : "Termii: TERMII_API_KEY, TERMII_SENDER_ID", "sms"],
    ["Email", providers.email && !emailFromProblem(), providers.email ? (emailFromProblem() ?? `Resend · from ${process.env.EMAIL_FROM}`) : "Resend: RESEND_API_KEY, EMAIL_FROM", "email"]
  ] as const;
  return (
    <>
      <PageHeading title="Church settings" description="Ministry details shown on the landing page and member portal." />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="card p-6">
          <ActionForm action={saveSettingsAction} className="grid gap-4 sm:grid-cols-2">
            <label className="label sm:col-span-2">Church name<input className="input mt-1" name="church_name" defaultValue={s.church_name} /></label>
            <label className="label sm:col-span-2">Tagline<input className="input mt-1" name="tagline" defaultValue={s.tagline ?? ""} /></label>
            <label className="label">Contact email<input className="input mt-1" name="contact_email" defaultValue={s.contact_email ?? ""} /></label>
            <label className="label">Contact phone<input className="input mt-1" name="contact_phone" defaultValue={s.contact_phone ?? ""} /></label>
            <label className="label sm:col-span-2">Address<input className="input mt-1" name="address" defaultValue={s.address ?? ""} /></label>
            <label className="label sm:col-span-2">Programmes &amp; service times<span className="hint">One per line: Name|When|Description (optional). Shown on the landing page.</span><textarea className="input mt-1 min-h-48 font-mono text-xs" name="service_times" defaultValue={s.service_times ?? ""} /></label>
            <label className="label sm:col-span-2">Livestream URL (YouTube / Facebook)<span className="hint">Leave empty to hide the “Watch online” button on the website</span><input className="input mt-1" name="livestream_url" defaultValue={s.livestream_url ?? ""} /></label>
            <label className="label">Bank name<input className="input mt-1" name="bank_name" defaultValue={s.bank_name ?? ""} /></label>
            <label className="label">Account number<input className="input mt-1" name="account_number" defaultValue={s.account_number ?? ""} /></label>
            <label className="label sm:col-span-2">Account name<input className="input mt-1" name="account_name" defaultValue={s.account_name ?? ""} /></label>
            <div className="sm:col-span-2"><SubmitButton>Save settings</SubmitButton></div>
          </ActionForm>
        </section>
        <section className="card p-6 xl:col-start-1" id="follow-up" data-testid="follow-up-settings">
          <h2 className="font-bold">Automatic follow-up for absent members</h2>
          <p className="mt-1 text-sm text-slate-500">When a member who has been coming to church misses Sundays in a row, they automatically get a caring message, then reminders until they come back. Runs every morning (about 10:00) and straight after Sunday check-in is closed. Only Sundays where attendance was taken count.</p>
          {!cronReady && <p className="alert alert-warn mt-3 text-sm">The daily run isn&apos;t scheduled yet: add <b>CRON_SECRET</b> (any long random text) in Vercel → Settings → Environment Variables, then redeploy. Until then messages only go out when Sunday check-in is closed or someone clicks <b>Check absences now</b> in Pastoral care.</p>}
          <ActionForm action={saveFollowUpSettingsAction} className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="checkbox sm:col-span-2"><input type="checkbox" name="auto_follow_up" defaultChecked={s.auto_follow_up} /> <span><b>Send automatic follow-up messages</b></span></label>
            <label className="label">Start after<select className="input mt-1" name="absence_threshold" defaultValue={String(s.absence_threshold)}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} missed Sunday{n === 1 ? "" : "s"} in a row</option>)}</select></label>
            <label className="label">Then remind every<select className="input mt-1" name="follow_up_every_days" defaultValue={String(s.follow_up_every_days)}>{[2, 3, 4, 5, 7, 10, 14].map((n) => <option key={n} value={n}>{n} days</option>)}</select></label>
            <label className="label">Keep going<select className="input mt-1" name="follow_up_max_messages" defaultValue={String(s.follow_up_max_messages)}><option value="0">Until they come back</option>{[2, 3, 5, 8, 12].map((n) => <option key={n} value={n}>Stop after {n} messages</option>)}</select></label>
            <fieldset className="label">Send on
              <div className="mt-2 flex flex-wrap gap-4 font-normal">
                {([["whatsapp", "WhatsApp", providers.whatsapp], ["sms", "SMS", providers.sms], ["email", "Email", providers.email]] as const).map(([v, l, ok]) => (
                  <label key={v} className="checkbox"><input type="checkbox" name="follow_up_channels" value={v} defaultChecked={s.follow_up_channels?.includes(v)} /> {l}{!ok && <span className="text-xs text-slate-400">(not set up)</span>}</label>
                ))}
              </div>
              <span className="hint">Plus the member&apos;s app inbox, always. Channels that aren&apos;t set up are skipped.</span>
            </fieldset>
            <label className="label sm:col-span-2">First message<span className="hint">Title: “We missed you”. Use {"{first_name}"} to personalise. Leave empty for the default.</span><textarea className="input mt-1 min-h-24" name="follow_up_first_message" maxLength={900} defaultValue={s.follow_up_first_message ?? ""} placeholder={DEFAULT_FIRST_MESSAGE} /></label>
            <label className="label sm:col-span-2">Reminder message<span className="hint">Title: “We&apos;re still thinking of you”. Leave empty for the default.</span><textarea className="input mt-1 min-h-24" name="follow_up_reminder_message" maxLength={900} defaultValue={s.follow_up_reminder_message ?? ""} placeholder={DEFAULT_REMINDER_MESSAGE} /></label>
            <div className="sm:col-span-2"><SubmitButton>Save follow-up settings</SubmitButton></div>
          </ActionForm>
        </section>
        <section className="card p-6 xl:col-start-1" id="welcome-emails" data-testid="welcome-emails">
          <h2 className="font-bold">✉️ Welcome emails</h2>
          <p className="mt-1 text-sm text-slate-500">Everyone with an email address gets a warm “Welcome to FUJ Online Church” email with their <b>flag username</b> and a link to <b>set a password</b> for their membership dashboard (optional — the link works for 30 days). New registrations get it straight away; people who registered earlier get it when you click below, when they next sign in, or with the daily job.</p>
          {welcome && (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-100 p-3"><p className="text-xs text-slate-500">Sent</p><p className="text-xl font-bold" data-testid="welcome-sent">{welcome.sent}</p></div>
              <div className="rounded-xl border border-slate-100 p-3"><p className="text-xs text-slate-500">Still to send</p><p className={`text-xl font-bold ${welcome.pending ? "text-[var(--accent)]" : ""}`} data-testid="welcome-pending">{welcome.pending}</p></div>
              <div className="rounded-xl border border-slate-100 p-3"><p className="text-xs text-slate-500">No email address</p><p className="text-xl font-bold">{welcome.noEmail}</p><p className="text-[11px] text-slate-400">They see their username in their portal</p></div>
            </div>
          )}
          {!providers.email && <p className="alert alert-warn mt-3 text-sm">Email isn&apos;t set up yet — add <b>RESEND_API_KEY</b> and <b>EMAIL_FROM</b> in Vercel (see Messaging channels). Nothing is lost: they&apos;ll go out once it is.</p>}
          {welcome && providers.email && (
            <ActionForm action={sendWelcomeBacklogAction} className="mt-4">
              {welcome.pending > 0
                ? <SubmitButton pendingText="Sending… (this can take a minute)">Send welcome emails now ({Math.min(welcome.pending, WELCOME_BATCH)} of {welcome.pending})</SubmitButton>
                : <p className="alert alert-ok text-sm">Everyone with an email address has their welcome email. ✓</p>}
              <p className="mt-2 text-xs text-slate-500">Sent {WELCOME_BATCH} at a time, a little apart, to respect the email provider&apos;s limits (Resend&apos;s free plan sends up to 100 emails a day). The daily job keeps going until everyone has theirs.</p>
            </ActionForm>
          )}
        </section>
        <section className="card p-6 xl:col-start-1" id="first-timers-partners" data-testid="first-timer-partner-settings">
          <h2 className="font-bold">First timers &amp; partners — automatic messages</h2>
          <p className="mt-1 text-sm text-slate-500">Sent on the same channels as the absence follow-up above, plus the person&apos;s app inbox. Use {"{first_name}"} to personalise; leave a message empty to use the default.</p>
          <ActionForm action={saveFirstTimerPartnerSettingsAction} className="mt-4 grid gap-4 sm:grid-cols-2">
            <p className="text-xs font-bold tracking-[.12em] text-slate-500 sm:col-span-2">FIRST TIMERS</p>
            <label className="checkbox sm:col-span-2"><input type="checkbox" name="first_timer_auto" defaultChecked={s.first_timer_auto} /> <span><b>Welcome first timers and invite them back automatically</b><span className="block text-xs font-normal text-slate-500">A welcome message straight away, then an invitation every Saturday until they come back to church.</span></span></label>
            <label className="label">Saturday invitations<select className="input mt-1" name="first_timer_max_invites" defaultValue={String(s.first_timer_max_invites)}><option value="0">None — welcome message only</option>{[1, 2, 3, 4, 6, 8].map((n) => <option key={n} value={n}>Up to {n}</option>)}</select></label>
            <span />
            <label className="label sm:col-span-2">Welcome message<span className="hint">Title: “Welcome to FlagUpJesus”.</span><textarea className="input mt-1 min-h-24" name="first_timer_welcome_message" maxLength={900} defaultValue={s.first_timer_welcome_message ?? ""} placeholder={DEFAULT_WELCOME_MESSAGE} /></label>
            <label className="label sm:col-span-2">Saturday invitation<span className="hint">Title: “See you this Sunday?”. {"{address}"} becomes the church address.</span><textarea className="input mt-1 min-h-24" name="first_timer_invite_message" maxLength={900} defaultValue={s.first_timer_invite_message ?? ""} placeholder={DEFAULT_INVITE_MESSAGE} /></label>
            <p className="mt-2 text-xs font-bold tracking-[.12em] text-slate-500 sm:col-span-2">FUJ PARTNERS</p>
            <label className="checkbox sm:col-span-2"><input type="checkbox" name="partner_auto" defaultChecked={s.partner_auto} /> <span><b>Thank new partners automatically</b><span className="block text-xs font-normal text-slate-500">When someone signs up to partner at registration or in their portal.</span></span></label>
            <label className="checkbox sm:col-span-2"><input type="checkbox" name="partner_reminders" defaultChecked={s.partner_reminders} /> <span><b>Send monthly partnership reminders</b><span className="block text-xs font-normal text-slate-500">To committed and active partners who haven&apos;t given yet this month (quarterly / yearly partners once per period), with the ministry&apos;s bank details.</span></span></label>
            <label className="label">Reminder day<select className="input mt-1" name="partner_reminder_day" defaultValue={String(s.partner_reminder_day)}>{Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>Day {d} of the month</option>)}</select></label>
            <span />
            <label className="label sm:col-span-2">Thank-you message<span className="hint">Title: “Thank you for partnering with us”.</span><textarea className="input mt-1 min-h-24" name="partner_thanks_message" maxLength={900} defaultValue={s.partner_thanks_message ?? ""} placeholder={DEFAULT_THANKS_MESSAGE} /></label>
            <label className="label sm:col-span-2">Monthly reminder<span className="hint">Title: “Your FlagUpJesus partnership”. {"{amount}"} = their pledge, {"{frequency}"} = monthly / quarterly / yearly. The bank details are added at the end.</span><textarea className="input mt-1 min-h-24" name="partner_reminder_message" maxLength={900} defaultValue={s.partner_reminder_message ?? ""} placeholder={DEFAULT_PARTNER_REMINDER} /></label>
            <div className="sm:col-span-2"><SubmitButton>Save first-timer &amp; partner settings</SubmitButton></div>
          </ActionForm>
        </section>
        <div className="space-y-6 xl:col-start-2 xl:row-span-4 xl:row-start-1">
          <section className="card p-6" id="messaging" data-testid="messaging-channels">
            <h2 className="font-bold">Messaging channels</h2>
            <p className="mt-1 text-xs text-slate-500">Where broadcasts can go besides the app inbox. Connect a channel by adding its keys in Vercel → Settings → Environment Variables, then redeploy (step-by-step guide in the README).</p>
            <ul className="mt-4 space-y-3 text-sm">
              {channels.map(([name, ok, how]) => (
                <li key={name} className="flex items-start justify-between gap-3">
                  <span><b>{name}</b><span className="block text-xs text-slate-500">{how}</span></span>
                  <span className={`pill shrink-0 ${ok ? "pill-green" : name === "Email" && providers.email ? "pill-amber" : "pill-gray"}`}>{ok ? "Connected" : name === "Email" && providers.email ? "Needs fixing" : "Not set up"}</span>
                </li>
              ))}
            </ul>
            {channels.some(([, ok]) => ok) && (
              <ActionForm action={sendTestMessageAction} className="mt-5 grid gap-2 border-t border-slate-100 pt-4">
                <p className="text-sm font-semibold">Send yourself a test</p>
                <select className="input" name="channel" aria-label="Test channel" defaultValue={channels.find(([, ok]) => ok)?.[3]}>{channels.filter(([, ok]) => ok).map(([name, , , key]) => <option key={key} value={key}>{name}</option>)}</select>
                <input className="input" name="to" required placeholder="Your phone number or email" aria-label="Send test to" />
                <SubmitButton className="btn btn-secondary" pendingText="Sending…">Send test</SubmitButton>
              </ActionForm>
            )}
          </section>
          <section className="card p-6">
            <h2 className="font-bold">Integrations</h2>
            <ul className="mt-3 space-y-2 text-sm">{integrations.map(([k, v, ok]) => <li key={k} className="flex justify-between gap-3"><span>{k}</span><span className={`pill ${ok ? "pill-green" : "pill-gray"}`}>{v}</span></li>)}</ul>
          </section>
          {can(admin.role, "staff") && (
            <section className="card p-6">
              <h2 className="font-bold">Staff &amp; roles</h2>
              <p className="mt-1 text-xs text-slate-500">Besides the shared FUJ admin login, individual staff can sign in with Google using the email listed here.</p>
              <ActionForm action={addStaffAction} className="mt-4 grid gap-2" resetOnSuccess>
                <input className="input" name="email" type="email" placeholder="name@gmail.com" required aria-label="Staff email" />
                <input className="input" name="full_name" placeholder="Display name" aria-label="Staff name" />
                <select className="input" name="role" defaultValue="pastoral_worker" aria-label="Role">{Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <SubmitButton className="btn btn-secondary">Add / update staff</SubmitButton>
              </ActionForm>
              <ul className="mt-5 divide-y divide-slate-100 text-sm">
                {staff.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-3 py-3">
                    <span className={u.active ? "" : "opacity-50"}><b>{u.full_name}</b><span className="block text-xs text-slate-500">{u.email} · {ROLE_LABELS[u.role]} · last login {formatDate(u.last_login_at)}</span></span>
                    {u.id !== admin.uid && <form action={toggleStaffAction}><input type="hidden" name="id" value={u.id} /><button className="btn btn-ghost btn-sm">{u.active ? "Disable" : "Enable"}</button></form>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
