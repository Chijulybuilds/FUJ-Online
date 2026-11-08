import { PageHeading } from "@/components/ui/page-heading";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { CopyButton } from "@/components/shared/copy-button";
import { requireMember } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { emailMyUsernameAction, setOwnPasswordAction, updateProfileAction } from "@/lib/actions/member";
import { credentialFor } from "@/lib/repo/accounts";
import { formatDate } from "@/lib/utils";

export default async function Profile() {
  const me = await requireMember();
  const p = (await db().get("people", { id: me.personId }))!;
  const credential = await credentialFor(p.id);
  return (
    <>
      <PageHeading title="My profile" description="Your church record. Contact the church office to change your name." />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <p className="text-xs text-slate-500">Check-in username</p>
          <div className="mt-1 flex items-center gap-3"><p className="username-badge text-2xl font-bold text-blue-600">{p.username}</p><CopyButton value={p.username ?? ""} /></div>
          <dl className="kv mt-6"><dt>Name</dt><dd>{p.full_name}</dd><dt>Member ID</dt><dd>{p.person_code}</dd><dt>Status</dt><dd className="capitalize">{p.status}</dd><dt>First visit</dt><dd>{formatDate(p.first_visit_at)}</dd></dl>
          {p.email && (
            <ActionForm action={emailMyUsernameAction} className="mt-5">
              <SubmitButton className="btn btn-secondary btn-sm" pendingText="Sending…">✉️ Email me my username</SubmitButton>
            </ActionForm>
          )}
        </section>
        <section className="card p-6">
          <ActionForm action={updateProfileAction} className="grid gap-3">
            <label className="label">Phone<input className="input mt-1" name="phone" defaultValue={p.phone} required /></label>
            <label className="label">Email<input className="input mt-1" name="email" type="email" defaultValue={p.email ?? ""} /></label>
            <label className="label">Birthday<input className="input mt-1" name="birthday" type="date" defaultValue={p.birthday ?? ""} /></label>
            <label className="label">Address<input className="input mt-1" name="address" defaultValue={p.address ?? ""} /></label>
            <div><SubmitButton>Save</SubmitButton></div>
          </ActionForm>
        </section>
        <section className="card p-6 lg:col-span-2" id="password" data-testid="password-card">
          <h2 className="font-bold">🔐 Password {credential && <span className="pill pill-green ml-2 align-middle">set</span>}</h2>
          <p className="mt-1 text-sm text-slate-500">{credential ? "Change the password you use to sign in with your username or email." : "Optional — set a password to sign in with your username (or email) and password. Your phone number keeps working too."}</p>
          <ActionForm action={setOwnPasswordAction} className="mt-4 grid gap-3 sm:grid-cols-3" resetOnSuccess>
            <input type="hidden" name="username" value={p.username ?? ""} autoComplete="username" />
            {credential && <label className="label">Current password<input className="input mt-1" name="current" type="password" required autoComplete="current-password" /></label>}
            <label className="label">{credential ? "New password" : "Password"}<span className="hint">At least 8 characters</span><input className="input mt-1" name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
            <label className="label">Type it again<input className="input mt-1" name="confirm" type="password" required minLength={8} autoComplete="new-password" /></label>
            <div className="sm:col-span-3"><SubmitButton>{credential ? "Change password" : "Set password"}</SubmitButton></div>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
