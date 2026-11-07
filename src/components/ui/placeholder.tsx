import type { ReactNode } from "react";

/**
 * Marks content FUJ hasn't provided yet (bank details, contacts, service times…).
 * Deliberately visible — dashed and bracketed — so nothing invented ever looks real.
 */
export function Placeholder({ children, where = "Admin → Settings", className = "" }: { children: ReactNode; where?: string; className?: string }) {
  return <span className={`ph ${className}`} title={`Placeholder — set this in ${where}`} data-placeholder>[{children}]</span>;
}
