import { PageHeading } from "@/components/ui/page-heading";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { createServiceAction } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth/session";

export default async function NewServicePage() {
  await requireAdmin("services");
  return (
    <>
      <PageHeading title="Create a service" description="Times are in Lagos time (WAT)." />
      <div className="card max-w-2xl p-6">
        <ActionForm action={createServiceAction} className="grid gap-4 sm:grid-cols-2">
          <label className="label sm:col-span-2">Service name<input className="input mt-2" name="title" required defaultValue="Sunday Celebration Service" /></label>
          <label className="label">Service type<select className="input mt-2" name="category"><option>Sunday worship</option><option>Bible study</option><option>Prayer meeting</option><option>Special event</option></select></label>
          <label className="label">Location<input className="input mt-2" name="location" defaultValue="Main auditorium" /></label>
          <label className="label">Starts<input className="input mt-2" name="starts_at" type="datetime-local" required /></label>
          <label className="label">Ends<input className="input mt-2" name="ends_at" type="datetime-local" /></label>
          <label className="label sm:col-span-2">Description<textarea className="input mt-2" name="description" /></label>
          <div className="sm:col-span-2"><SubmitButton>Create service</SubmitButton></div>
        </ActionForm>
      </div>
    </>
  );
}
