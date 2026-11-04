import { PageHeading } from "@/components/ui/page-heading";
export default function Page() {
 return <><PageHeading title="Prayer requests" description="Review requests and manage their visibility and pastoral access."/><div className="card p-6"><div className="rounded-xl border border-slate-100 p-5"><p className="font-semibold">Prayer request review workflow</p><p className="mt-2 text-sm text-slate-500">Requests should be private by default. Only authorized pastoral workers should see confidential requests. Add moderation and consent before publishing any request.</p></div></div></>;
}
