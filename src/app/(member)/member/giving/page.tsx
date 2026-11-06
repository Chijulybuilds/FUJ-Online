import { PageHeading } from "@/components/ui/page-heading";
import { CopyButton } from "@/components/shared/copy-button";
import { requireMember } from "@/lib/auth/session";
import { getSettings } from "@/lib/repo/settings";
import { donationsForPerson } from "@/lib/repo/giving";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function Giving() {
  const me = await requireMember();
  const [s, mine] = await Promise.all([getSettings(), donationsForPerson(me.personId)]);
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
      </div>
    </>
  );
}
