import { PageHeading } from "@/components/ui/page-heading";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { createPersonAction } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth/session";

export default async function NewMemberPage() {
  await requireAdmin("members");
  return (
    <>
      <PageHeading title="Add a member" description="Usher / admin registration. A unique flag username is generated automatically — share it with them for future check-ins." />
      <div className="card max-w-2xl p-6">
        <ActionForm action={createPersonAction} className="grid gap-4 sm:grid-cols-2">
          <label className="label sm:col-span-2">Full name<input className="input mt-2" name="full_name" required placeholder="Full name" /></label>
          <label className="label">Phone number<input className="input mt-2" name="phone" required inputMode="tel" placeholder="080X XXX XXXX" /></label>
          <label className="label">Email (optional)<input className="input mt-2" name="email" type="email" /></label>
          <label className="label">Gender<select className="input mt-2" name="gender"><option value="">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option></select></label>
          <label className="label">Birthday<input className="input mt-2" name="birthday" type="date" /></label>
          <label className="label">How did they hear about us?<input className="input mt-2" name="how_heard" placeholder="Friend, social media…" /></label>
          <label className="label sm:col-span-2">Address<input className="input mt-2" name="address" /></label>
          <label className="label sm:col-span-2">Notes<textarea className="input mt-2" name="notes" /></label>
          <div className="sm:col-span-2"><SubmitButton>Create record</SubmitButton></div>
        </ActionForm>
      </div>
    </>
  );
}
