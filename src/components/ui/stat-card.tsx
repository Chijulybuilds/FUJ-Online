import type { ReactNode } from "react";
export function StatCard({ label, value, change, icon, tone="blue" }: { label:string; value:string; change:string; icon:ReactNode; tone?:string }) {
  const tones:Record<string,string> = { blue:"bg-blue-50 text-blue-600", green:"bg-emerald-50 text-emerald-600", amber:"bg-amber-50 text-amber-600", violet:"bg-violet-50 text-violet-600" };
  return <div className="card p-5"><div className="flex items-start justify-between"><p className="text-sm font-medium text-slate-500">{label}</p><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone] ?? tones.blue}`}>{icon}</span></div><p className="mt-4 text-2xl font-bold text-slate-900">{value}</p><p className="mt-1 text-xs text-slate-500">{change}</p></div>;
}
