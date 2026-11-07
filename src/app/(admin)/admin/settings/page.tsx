import { PageHeading } from "@/components/ui/page-heading";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { requireAdmin } from "@/lib/auth/session";
import { can, ROLE_LABELS } from "@/lib/auth/roles";
import { getSettings } from "@/lib/repo/settings";
import { addStaffAction, saveFollowUpSettingsAction, saveSettingsAction, sendTestMessageAction, toggleStaffAction } from "@/lib/actions/admin";
import { DEFAULT_FIRST_MESSAGE, DEFAULT_REMINDER_MESSAGE } from "@/lib/repo/auto-follow-up";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { providers } from "@/lib/messaging/providers";
import { formatDate } from "@/lib/utils";

export default async function SettingsPage() {
  const admin = await requireAdmin("settings");
  const [s, staff] = await Promise.all([getSettings(), can(admin.role, "staff") ? db().list("admin_users", { order: { column: "created_at" } }) : Promise.resolve([])]);
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
    ["Email", providers.email, providers.email ? `Resend · from ${process.env.EMAIL_FROM}` : "Resend: RESEND_API_KEY, EMAIL_FROM", "email"]
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
        <div className="space-y-6 xl:col-start-2 xl:row-span-2 xl:row-start-1">
          <section className="card p-6" id="messaging" data-testid="messaging-channels">
            <h2 className="font-bold">Messaging channels</h2>
            <p className="mt-1 text-xs text-slate-500">Where broadcasts can go besides the app inbox. Connect a channel by adding its keys in Vercel → Settings → Environment Variables, then redeploy (step-by-step guide in the README).</p>
            <ul className="mt-4 space-y-3 text-sm">
              {channels.map(([name, ok, how]) => (
                <li key={name} className="flex items-start justify-between gap-3">
                  <span><b>{name}</b><span className="block text-xs text-slate-500">{how}</span></span>
                  <span className={`pill shrink-0 ${ok ? "pill-green" : "pill-gray"}`}>{ok ? "Connected" : "Not set up"}</span>
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
