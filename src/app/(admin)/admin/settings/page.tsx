import { PageHeading } from "@/components/ui/page-heading";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { requireAdmin } from "@/lib/auth/session";
import { can, ROLE_LABELS } from "@/lib/auth/roles";
import { getSettings } from "@/lib/repo/settings";
import { addStaffAction, saveSettingsAction, toggleStaffAction } from "@/lib/actions/admin";
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
    ["SMS (Termii)", providers.sms ? "Configured" : "Not configured", providers.sms],
    ["Email (Resend)", providers.email ? "Configured" : "Not configured", providers.email]
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
            <label className="label sm:col-span-2">Service times<span className="hint">One per line: Name|When</span><textarea className="input mt-1" name="service_times" defaultValue={s.service_times ?? ""} /></label>
            <label className="label sm:col-span-2">Livestream URL (YouTube / Facebook)<input className="input mt-1" name="livestream_url" defaultValue={s.livestream_url ?? ""} /></label>
            <label className="label">Bank name<input className="input mt-1" name="bank_name" defaultValue={s.bank_name ?? ""} /></label>
            <label className="label">Account number<input className="input mt-1" name="account_number" defaultValue={s.account_number ?? ""} /></label>
            <label className="label sm:col-span-2">Account name<input className="input mt-1" name="account_name" defaultValue={s.account_name ?? ""} /></label>
            <label className="label">Absence threshold<span className="hint">Consecutive missed services before a follow-up</span><input className="input mt-1" name="absence_threshold" type="number" min={1} max={8} defaultValue={s.absence_threshold} /></label>
            <div className="sm:col-span-2"><SubmitButton>Save settings</SubmitButton></div>
          </ActionForm>
        </section>
        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="font-bold">Integrations</h2>
            <ul className="mt-3 space-y-2 text-sm">{integrations.map(([k, v, ok]) => <li key={k} className="flex justify-between gap-3"><span>{k}</span><span className={`pill ${ok ? "pill-green" : "pill-gray"}`}>{v}</span></li>)}</ul>
          </section>
          {can(admin.role, "staff") && (
            <section className="card p-6">
              <h2 className="font-bold">Staff &amp; roles</h2>
              <p className="mt-1 text-xs text-slate-500">Staff sign in with Google using the email listed here.</p>
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
