import type { ReactNode } from "react";
export function PageHeading({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return <div className="mb-7 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>{description && <p className="mt-1 text-sm text-slate-500">{description}</p>}</div>{action && <div className="flex flex-wrap gap-2">{action}</div>}</div>;
}
