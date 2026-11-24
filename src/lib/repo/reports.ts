import "server-only";
import { db } from "@/lib/db";
import { serviceSummaries } from "./services";
import { nextBirthday } from "@/lib/children";

export async function dashboardStats() {
  const [people, prayers, testimonies, donations, attendance] = await Promise.all([
    db().list("people"), db().list("prayer_requests"), db().list("testimonies"), db().list("donations"), db().list("attendance")
  ]);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const summaries = await serviceSummaries(8);
  // Totals are in naira; gifts in other currencies (associate partners abroad) show on their partner page.
  const paid = donations.filter((d) => d.status === "paid" && (d.currency || "NGN") === "NGN");
  return {
    totalPeople: people.filter((p) => p.status !== "associate").length,
    members: people.filter((p) => p.status === "member").length,
    inactive: people.filter((p) => p.status !== "member" && p.status !== "associate").length,
    newThisMonth: people.filter((p) => p.status !== "associate" && new Date(p.created_at) >= monthStart).length,
    pendingPrayers: prayers.filter((p) => p.status === "pending").length,
    pendingTestimonies: testimonies.filter((t) => t.status === "pending").length,
    givingThisMonth: paid.filter((d) => d.paid_at && new Date(d.paid_at) >= monthStart).reduce((s, d) => s + Number(d.amount), 0),
    totalCheckIns: attendance.length,
    // Older databases (setup.sql not re-run yet) simply show 0.
    childrenBirthdaysThisWeek: people.filter((p) => p.is_child && (nextBirthday(p.birthday)?.days ?? 99) <= 7).length,
    children: people.filter((p) => p.is_child).length,
    missedSundays: await import("./absence").then((m) => m.absentMembers()).then((r) => r.absentees.length, () => 0),
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
      newPeople: people.filter((p) => p.status !== "associate" && inRange(p.created_at)).length,
      giving: donations.filter((d) => d.status === "paid" && (d.currency || "NGN") === "NGN" && inRange(d.paid_at)).reduce((s, d) => s + Number(d.amount), 0),
      checkIns: attendance.filter((a) => inRange(a.checked_in_at)).length
    });
  }
  return out;
}
