const TONE: Record<string, string> = {
  member: "pill-green", inactive: "pill-gray", transferred: "pill-gray", left_ministry: "pill-gray",
  scheduled: "pill-blue", active: "pill-green", completed: "pill-gray", cancelled: "pill-red",
  open: "pill-amber", in_progress: "pill-blue", dismissed: "pill-gray",
  draft: "pill-gray", published: "pill-green", archived: "pill-gray",
  pending: "pill-amber", praying: "pill-blue", answered: "pill-green", closed: "pill-gray", approved: "pill-green", declined: "pill-red",
  high: "pill-red", normal: "pill-gray", low: "pill-gray", paid: "pill-green", failed: "pill-red", sent: "pill-green", skipped: "pill-gray"
};
export function StatusPill({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="pill pill-gray">—</span>;
  return <span className={`pill ${TONE[value] ?? "pill-gray"}`}>{value.replace(/_/g, " ")}</span>;
}
