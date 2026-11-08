import { PageHeading } from "@/components/ui/page-heading";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { CopyButton } from "@/components/shared/copy-button";
import { requireMember } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { childrenOf } from "@/lib/repo/people";
import { addChildAction } from "@/lib/actions/member";
import { ageGroupOf, ageLabel, ageOf, childEmoji, nextBirthday, RELATIONSHIPS } from "@/lib/children";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MyChildren() {
  const me = await requireMember();
  const parent = await db().get("people", { id: me.personId });
  if (!parent || parent.is_child) {
    return (
      <>
        <PageHeading title="My children" />
        <p className="card p-6 text-sm text-slate-600">This page is for parents and guardians. Ask your parent to sign in with their own username to see the family.</p>
      </>
    );
  }
  const kids = await childrenOf(parent);
  const attendance = kids.length ? await db().list("attendance", { where: { person_id: kids.map((k) => k.id) } }) : [];
  return (
    <>
      <PageHeading title="My children" description="Register your children who don't have their own phone. Each child gets their own username for check-in — messages about them come to you." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="space-y-4" data-testid="my-children">
          {kids.map((k) => {
            const age = ageOf(k.birthday);
            const group = ageGroupOf(age);
            const bday = nextBirthday(k.birthday);
            const mine = attendance.filter((a) => a.person_id === k.id);
            const last = mine.reduce<string | null>((m, a) => (!m || a.checked_in_at > m ? a.checked_in_at : m), null);
            return (
              <article key={k.id} className="kid-card card p-5" data-testid="child-card">
                <div className="flex items-start gap-4">
                  <span className="kid-avatar" aria-hidden>{childEmoji(k.gender, age)}</span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold">{k.full_name}</h2>
                    <p className="text-sm text-slate-500">{ageLabel(k.birthday)}{group && <> · <span className="pill pill-blue">{group.emoji} {group.label}</span></>}</p>
                    {bday && <p className="mt-1 text-sm">{bday.days === 0 ? <b>🎉 Happy birthday today — {bday.turning}!</b> : <>🎂 Birthday in <b>{bday.days} day{bday.days === 1 ? "" : "s"}</b> — turning {bday.turning}</>}</p>}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
                  <div><p className="text-xs text-slate-500">Check-in username</p><p className="username-badge text-lg font-bold text-blue-600">{k.username}</p></div>
                  <CopyButton value={k.username ?? ""} />
                </div>
                <p className="mt-3 text-xs text-slate-500">{mine.length ? `In church ${mine.length} time${mine.length === 1 ? "" : "s"} · last ${formatDate(last)}` : "Not checked in yet"}{k.care_notes ? " · 📝 care notes on file" : ""}</p>
              </article>
            );
          })}
          {!kids.length && (
            <div className="card p-8 text-center text-sm text-slate-500">
              <p className="text-4xl" aria-hidden>👨‍👩‍👧‍👦</p>
              <p className="mt-3 font-semibold text-slate-700">No children registered yet</p>
              <p className="mt-1">Add your first child with the form — it takes less than a minute.</p>
            </div>
          )}
          <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-600">
            <b>On Sunday:</b> scan the QR code and check yourself in — then tap <b>Check in your children</b>. Or type a child&apos;s username yourself.
          </div>
        </section>
        <section className="card h-fit p-6">
          <h2 className="font-bold">Add a child</h2>
          <p className="mt-1 text-xs text-slate-500">Uses your phone number ({parent.phone}). Only the children&apos;s church team sees the notes.</p>
          <ActionForm action={addChildAction} className="mt-4 grid gap-3" resetOnSuccess>
            <label className="label">Child&apos;s full name<input className="input mt-1" name="full_name" required placeholder="e.g. Tobi Adeyemi" /></label>
            <label className="label">Birthday<input className="input mt-1" name="birthday" type="date" required min="2000-01-01" /></label>
            <fieldset className="label">
              <legend>Boy or girl? <span className="font-normal text-slate-400">(optional)</span></legend>
              <div className="choice-grid">
                <label className="choice"><input type="radio" name="gender" value="male" /><span>👦 Boy</span></label>
                <label className="choice"><input type="radio" name="gender" value="female" /><span>👧 Girl</span></label>
              </div>
            </fieldset>
            <label className="label">You are their<select className="input mt-1" name="relationship" defaultValue="">{[["", "Choose…"], ...RELATIONSHIPS.map((r) => [r, r])].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <fieldset className="label">
              <legend>First time at FlagUpJesus?</legend>
              <div className="choice-grid">
                <label className="choice"><input type="radio" name="first_timer" value="yes" /><span>🎉 Yes</span></label>
                <label className="choice"><input type="radio" name="first_timer" value="no" defaultChecked /><span>🙌 No</span></label>
              </div>
            </fieldset>
            <label className="label">Anything we should know? <span className="font-normal text-slate-400">(optional)</span><textarea className="input mt-1 min-h-[4rem]" name="care_notes" maxLength={500} placeholder="Allergies, medical needs, who may pick them up…" /></label>
            <label className="label">Home address<input className="input mt-1" name="address" defaultValue={parent.address ?? ""} /></label>
            <SubmitButton pendingText="Registering…">Register my child</SubmitButton>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
