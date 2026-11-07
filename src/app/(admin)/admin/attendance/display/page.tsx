import Link from "next/link";
import { QrCode } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { activeSessions, listServices } from "@/lib/repo/services";
import { openCheckInAction } from "@/lib/actions/admin";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { formatDateTime } from "@/lib/utils";
import { QrDisplay } from "./qr-display";

export default async function AttendanceDisplayPage({ searchParams }: { searchParams: Promise<{ service?: string }> }) {
  await requireAdmin("attendance");
  const { service } = await searchParams;
  const sessions = await activeSessions();
  const serviceId = service ?? sessions[0]?.service_id;
  if (serviceId && sessions.some((s) => s.service_id === serviceId)) return <QrDisplay serviceId={serviceId} />;
  const candidates = (await listServices()).filter((s) => s.status === "scheduled" || s.status === "active").slice(0, 6);
  return (
    <div className="qr-stage fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur">
        <QrCode className="text-red-300" size={32} />
        <h1 className="mt-4 text-2xl font-bold">Start QR check-in</h1>
        <p className="mt-2 text-sm text-slate-300">Choose a service to open check-in. The code on screen will refresh every 20 seconds.</p>
        <div className="mt-6 space-y-2">
          {candidates.map((s) => (
            <ActionForm key={s.id} action={openCheckInAction} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 p-4">
              <input type="hidden" name="service_id" value={s.id} /><input type="hidden" name="then" value="display" />
              <span><b>{s.title}</b><span className="block text-xs text-slate-400">{formatDateTime(s.starts_at)}</span></span>
              <SubmitButton className="btn lp-btn-light btn-sm" pendingText="Opening…">Open check-in</SubmitButton>
            </ActionForm>
          ))}
          {!candidates.length && <p className="text-sm text-slate-400">No upcoming services. <Link className="underline" href="/admin/services/new">Create one</Link>.</p>}
        </div>
        <Link href="/admin/attendance" className="mt-6 inline-block text-sm text-slate-400 hover:text-white">← Back to attendance</Link>
      </div>
    </div>
  );
}
