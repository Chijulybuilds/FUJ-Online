import { PageHeading } from "@/components/ui/page-heading";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { CopyButton } from "@/components/shared/copy-button";
import { requireMember } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { updateProfileAction } from "@/lib/actions/member";
import { formatDate } from "@/lib/utils";

export default async function Profile() {
  const me = await requireMember();
  const p = (await db().get("people", { id: me.personId }))!;
  return (
    <>
      <PageHeading title="My profile" description="Your church record. Contact the church office to change your name." />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <p className="text-xs text-slate-500">Check-in username</p>
          <div className="mt-1 flex items-center gap-3"><p className="username-badge text-2xl font-bold text-blue-600">{p.username}</p><CopyButton value={p.username ?? ""} /></div>
          <dl className="kv mt-6"><dt>Name</dt><dd>{p.full_name}</dd><dt>Member ID</dt><dd>{p.person_code}</dd><dt>Status</dt><dd className="capitalize">{p.status}</dd><dt>First visit</dt><dd>{formatDate(p.first_visit_at)}</dd></dl>
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
      </div>
    </>
  );
}
