import Link from "next/link";
import { QrCode } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { requireAdmin } from "@/lib/auth/session";
import { activeSessions, listServices } from "@/lib/repo/services";
import { formatDateTime } from "@/lib/utils";
import { Desk } from "./desk";

export default async function CheckInDeskPage({ searchParams }: { searchParams: Promise<{ service?: string }> }) {
  await requireAdmin("attendance");
  const { service } = await searchParams;
  const [services, sessions] = await Promise.all([listServices(), activeSessions()]);
  const now = Date.now();
  // Services worth checking into: open QR sessions, plus anything from 2 days ago to 2 days ahead.
  const candidates = services.filter((s) => s.status !== "cancelled" && (sessions.some((x) => x.service_id === s.id) || Math.abs(new Date(s.starts_at).getTime() - now) < 2 * 86400000));
  const selected = candidates.find((s) => s.id === service) ?? candidates.find((s) => sessions.some((x) => x.service_id === s.id)) ?? candidates.sort((a, b) => Math.abs(new Date(a.starts_at).getTime() - now) - Math.abs(new Date(b.starts_at).getTime() - now))[0];
  return (
    <>
      <PageHeading title="Check-in desk" description="Check members in by name — no phone or QR needed. Works alongside the QR display."
        action={selected && <Link href={`/admin/attendance/display?service=${selected.id}`} className="btn btn-secondary"><QrCode size={16} /> QR display</Link>} />
      {candidates.length > 1 && (
        <div className="tabs mb-5">{candidates.map((s) => <Link key={s.id} href={`/admin/attendance/desk?service=${s.id}`} className={`tab ${selected?.id === s.id ? "active" : ""}`}>{s.title} · {formatDateTime(s.starts_at)}</Link>)}</div>
      )}
      {selected ? <Desk serviceId={selected.id} serviceTitle={selected.title} /> : <p className="empty">No service today. <Link className="text-blue-600" href="/admin/services/new">Create a service</Link> first.</p>}
    </>
  );
}
