import { PageHeading } from "@/components/ui/page-heading";
import { CopyButton } from "@/components/shared/copy-button";
import { requireMember } from "@/lib/auth/session";
import { getSettings } from "@/lib/repo/settings";
import { donationsForPerson } from "@/lib/repo/giving";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { becomePartnerAction } from "@/lib/actions/member";
import { FREQUENCIES, frequencyLabel, partnerStatusLabel } from "@/lib/repo/partners";
import { db } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function Giving() {
  const me = await requireMember();
  const [s, mine, partner] = await Promise.all([getSettings(), donationsForPerson(me.personId), db().get("partners", { person_id: me.personId }).catch(() => null)]);
  const isPartner = partner && partner.status !== "declined";
  return (
    <>
      <PageHeading title="Giving" description="“Each of you should give what you have decided in your heart to give.” — 2 Corinthians 9:7" />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="brand-panel rounded-3xl p-7">
          <p className="text-sm text-red-200">Bank transfer</p>
          {s.account_number ? (
            <>
              <p className="mt-4 text-xs text-slate-400">{s.bank_name}</p>
              <div className="flex items-center gap-3"><p className="text-3xl font-extrabold tracking-wider">{s.account_number}</p><CopyButton value={s.account_number} className="btn lp-btn-glass btn-sm" /></div>
              <p className="mt-1 text-sm text-slate-300">{s.account_name}</p>
              <p className="mt-6 text-xs text-slate-400">Use your username <b className="text-white">as the transfer narration</b> so we can record your giving.</p>
            </>
          ) : <p className="mt-4 text-sm text-slate-300">Bank details will be shared by the church office.</p>}
        </section>
        <section className="card p-6">
          <h2 className="font-bold">My giving history</h2>
          <ul className="mt-3 divide-y divide-slate-100 text-sm">{mine.map((d) => <li key={d.id} className="flex justify-between py-2"><span>{d.fund_name} · {formatDate(d.paid_at)}</span><b>{formatCurrency(d.amount)}</b></li>)}{!mine.length && <li className="py-2 text-slate-500">No recorded giving yet.</li>}</ul>
          <p className="mt-4 text-xs text-slate-400">Online card payments will be enabled once a verified payment provider is connected.</p>
        </section>
        <section className="card p-6 lg:col-span-2" id="partner" data-testid="partner-card">
          {isPartner ? (
            <>
              <h2 className="font-bold">💛 You&apos;re a FUJ Partner</h2>
              <p className="mt-2 text-sm text-slate-600">Thank you for standing with FlagUpJesus Global Ministry. {partner.pledge_amount ? <>Your pledge: <b>{formatCurrency(Number(partner.pledge_amount))}</b> · {frequencyLabel(partner.frequency).toLowerCase()}.</> : "Our partnership team will be in touch about how you'd like to give."} <span className="text-slate-400">({partnerStatusLabel(partner.status)})</span></p>
              <p className="mt-2 text-xs text-slate-500">Give by bank transfer above with your username as the narration, so it&apos;s recorded against your partnership.</p>
            </>
          ) : (
            <>
              <h2 className="font-bold">💛 Become a FUJ Partner</h2>
              <p className="mt-2 text-sm text-slate-600">Partners support the work of the ministry — outreaches, missions and taking the gospel further — with regular giving. Tell us you&apos;d like to partner and our partnership team will reach out to you.</p>
              <ActionForm action={becomePartnerAction} className="mt-4 flex flex-wrap items-end gap-3">
                <label className="label">Amount you&apos;d like to give (₦) <span className="font-normal text-slate-400">(optional)</span><input className="input mt-1" name="pledge_amount" inputMode="decimal" placeholder="e.g. 10,000" /></label>
                <label className="label">How often<select className="input mt-1" name="frequency" defaultValue="monthly">{FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select></label>
                <SubmitButton pendingText="Sending…">I want to partner</SubmitButton>
              </ActionForm>
            </>
          )}
        </section>
      </div>
    </>
  );
}
