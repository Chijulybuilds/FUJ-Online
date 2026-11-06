import { PageHeading } from "@/components/ui/page-heading";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { requireAdmin } from "@/lib/auth/session";
import { createDepartmentAction, toggleDepartmentAction } from "@/lib/actions/admin";
import { db } from "@/lib/db";
import { peopleById } from "@/lib/repo/people";
import Link from "next/link";

export default async function DepartmentsPage() {
  await requireAdmin("departments");
  const [departments, links, people] = await Promise.all([db().list("departments", { order: { column: "name" } }), db().list("member_departments"), peopleById()]);
  return (
    <>
      <PageHeading title="Departments" description="Ministry teams. Add people to a team from their member record." />
      <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
        <section className="card p-6">
          <h2 className="mb-4 font-bold">New department</h2>
          <ActionForm action={createDepartmentAction} className="space-y-3" resetOnSuccess>
            <input className="input" name="name" placeholder="e.g. Choir" required aria-label="Name" />
            <textarea className="input min-h-20" name="description" placeholder="Description" />
            <select className="input" name="leader_person_id" aria-label="Leader"><option value="">Leader (optional)</option>{[...people.values()].map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select>
            <SubmitButton>Create</SubmitButton>
          </ActionForm>
        </section>
        <section className="grid gap-4 sm:grid-cols-2">
          {departments.map((d) => {
            const members = links.filter((l) => l.department_id === d.id && l.is_active).map((l) => people.get(l.person_id)).filter(Boolean);
            return (
              <article key={d.id} className={`card p-5 ${d.is_active ? "" : "opacity-60"}`}>
                <div className="flex items-start justify-between"><div><p className="font-bold">{d.name}</p><p className="text-xs text-slate-500">{d.description}</p></div><span className="pill pill-blue">{members.length}</span></div>
                {d.leader_person_id && <p className="mt-2 text-xs">Leader: <b>{people.get(d.leader_person_id)?.full_name}</b></p>}
                <div className="mt-3 flex flex-wrap gap-1">{members.slice(0, 8).map((p) => <Link key={p!.id} href={`/admin/members/${p!.id}`} className="pill pill-gray">{p!.full_name}</Link>)}</div>
                <form action={toggleDepartmentAction} className="mt-3"><input type="hidden" name="id" value={d.id} /><button className="btn btn-ghost btn-sm">{d.is_active ? "Deactivate" : "Reactivate"}</button></form>
              </article>
            );
          })}
        </section>
      </div>
    </>
  );
}
