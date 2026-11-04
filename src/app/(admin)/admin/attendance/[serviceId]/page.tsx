import { PageHeading } from "@/components/ui/page-heading";
export default async function ServiceAttendancePage({ params }: { params:Promise<{serviceId:string}> }) {
 const {serviceId}=await params;
 return <><PageHeading title="Service attendance" description={`Attendance record for ${serviceId}.`}/><div className="card p-8 text-sm text-slate-500">Connect the attendance repository to load this service&apos;s check-ins. The database enforces one attendance record per person per service.</div></>;
}
