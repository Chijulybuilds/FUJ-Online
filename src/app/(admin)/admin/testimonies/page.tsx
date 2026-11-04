import { PageHeading } from "@/components/ui/page-heading";
export default function Page() {
 return <><PageHeading title="Testimonies" description="Review submitted testimonies before publishing."/><div className="card p-6"><div className="rounded-xl border border-slate-100 p-5"><p className="font-semibold">Moderation queue</p><p className="mt-2 text-sm text-slate-500">Testimonies submitted by members should remain unpublished until an authorized reviewer approves them.</p></div></div></>;
}
