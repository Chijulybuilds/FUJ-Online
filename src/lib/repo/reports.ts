import "server-only";
import { db } from "@/lib/db";
import { serviceSummaries } from "./services";

export async function dashboardStats() {
  const [people, tasks, prayers, testimonies, donations, attendance] = await Promise.all([
    db().list("people"), db().list("follow_up_tasks"), db().list("prayer_requests"), db().list("testimonies"), db().list("donations"), db().list("attendance")
  ]);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const summaries = await serviceSummaries(8);
  const paid = donations.filter((d) => d.status === "paid");
  return {
    totalPeople: people.length,
    members: people.filter((p) => p.status === "member").length,
    inactive: people.filter((p) => p.status !== "member").length,
    newThisMonth: people.filter((p) => new Date(p.created_at) >= monthStart).length,
    openTasks: tasks.filter((t) => t.status === "open" || t.status === "in_progress").length,
    pendingPrayers: prayers.filter((p) => p.status === "pending").length,
    pendingTestimonies: testimonies.filter((t) => t.status === "pending").length,
    givingThisMonth: paid.filter((d) => d.paid_at && new Date(d.paid_at) >= monthStart).reduce((s, d) => s + Number(d.amount), 0),
    totalCheckIns: attendance.length,
    // Older databases (setup.sql not re-run yet) simply show 0.
    firstTimersToWelcome: await db().list("first_timers", { where: { stage: "new" } }).then((r) => r.length, () => 0),
    partnerFollowUpsDue: await db().list("partners").then((r) => r.filter((p) => p.status !== "declined" && p.next_follow_up_at && new Date(p.next_follow_up_at).getTime() <= Date.now()).length, () => 0),
    summaries
  };
}

export async function monthlySeries(months = 6) {
  const [people, donations, attendance] = await Promise.all([db().list("people"), db().list("donations"), db().list("attendance")]);
  const out: { label: string; newPeople: number; giving: number; checkIns: number }[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const inRange = (v: string | null) => Boolean(v) && new Date(v!) >= start && new Date(v!) < end;
    out.push({
      label: start.toLocaleString("en-NG", { month: "short" }),
      newPeople: people.filter((p) => inRange(p.created_at)).length,
      giving: donations.filter((d) => d.status === "paid" && inRange(d.paid_at)).reduce((s, d) => s + Number(d.amount), 0),
      checkIns: attendance.filter((a) => inRange(a.checked_in_at)).length
    });
  }
  return out;
}
