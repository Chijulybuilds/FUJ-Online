import { PageHeading } from "@/components/ui/page-heading";
import { StatusPill } from "@/components/ui/status-pill";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { requireAdmin } from "@/lib/auth/session";
import { listDonations } from "@/lib/repo/giving";
import { recordDonationAction } from "@/lib/actions/admin";
import { formatAmounts, formatCurrency, formatDate } from "@/lib/utils";
import { CURRENCIES } from "@/lib/repo/partners";

export default async function GivingPage() {
  await requireAdmin("giving");
  const donations = await listDonations();
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const paid = donations.filter((d) => d.status === "paid");
  const month = paid.filter((d) => d.paid_at && new Date(d.paid_at) >= monthStart);
  // Kept per currency: gifts from associate partners abroad are never added to naira.
  const add = (m: Map<string, number>, c: string, v: number) => m.set(c, (m.get(c) ?? 0) + v);
  const monthTotals = new Map<string, number>();
  const byFund = new Map<string, Map<string, number>>();
  month.forEach((d) => { const c = d.currency || "NGN"; add(monthTotals, c, d.amount); add(byFund.get(d.fund_name) ?? byFund.set(d.fund_name, new Map()).get(d.fund_name)!, c, d.amount); });
  return (
    <>
      <PageHeading title="Giving & donations" description="Record cash/transfer giving. Online payments must be confirmed by a verified provider webhook — never a browser redirect." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="card p-5"><p className="text-xs text-slate-500">This month</p><p className="mt-2 text-2xl font-bold">{formatAmounts(monthTotals)}</p></div>
        <div className="card p-5"><p className="text-xs text-slate-500">Records this month</p><p className="mt-2 text-2xl font-bold">{month.length}</p></div>
        <div className="card p-5"><p className="text-xs text-slate-500">By fund</p><div className="mt-2 space-y-1 text-sm">{[...byFund].map(([f, v]) => <p key={f} className="flex justify-between gap-3"><span>{f}</span><b>{formatAmounts(v)}</b></p>)}{!byFund.size && <p className="text-slate-400">—</p>}</div></div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
        <section className="card p-6">
          <h2 className="mb-4 font-bold">Record giving</h2>
          <ActionForm action={recordDonationAction} className="grid gap-3" resetOnSuccess>
            <div className="grid grid-cols-[1fr_7rem] gap-3">
              <label className="label">Amount<input className="input mt-1" name="amount" inputMode="decimal" required placeholder="Amount" /></label>
              <label className="label">Currency<select className="input mt-1" name="currency" defaultValue="NGN">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></label>
            </div>
            <label className="label">Fund<select className="input mt-1" name="fund_name"><option>Offering</option><option>Tithe</option><option>Building fund</option><option>Missions</option><option>Welfare</option><option>Thanksgiving</option></select></label>
            <label className="label">Method<select className="input mt-1" name="method"><option value="cash">Cash</option><option value="transfer">Bank transfer</option><option value="pos">POS</option></select></label>
            <label className="label">Member or partner username<span className="hint">Optional — links it to their giving history (associate partners have one too)</span><input className="input mt-1" name="person" placeholder="flagyourname123" /></label>
            <label className="label">Donor name (if not a member)<input className="input mt-1" name="donor_name" /></label>
            <label className="label">Date<input className="input mt-1" name="paid_at" type="date" /></label>
            <label className="label">Note<input className="input mt-1" name="note" /></label>
            <SubmitButton>Record</SubmitButton>
          </ActionForm>
        </section>
        <section className="card">
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Giver</th><th>Fund</th><th>Method</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {donations.map((d) => <tr key={d.id}><td>{formatDate(d.paid_at ?? d.created_at)}</td><td>{d.person?.full_name ?? d.donor_name ?? "Anonymous"}</td><td>{d.fund_name}</td><td>{d.method}</td><td><b>{formatCurrency(d.amount, d.currency)}</b></td><td><StatusPill value={d.status} /></td></tr>)}
                {!donations.length && <tr><td colSpan={6} className="text-center text-slate-500">No giving recorded yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
