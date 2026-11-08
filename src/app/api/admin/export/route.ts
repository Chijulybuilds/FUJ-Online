import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { listPeople, peopleById } from "@/lib/repo/people";
import { audit } from "@/lib/repo/audit";
import { toVcf } from "@/lib/vcard";
import { leaderPeople } from "@/lib/repo/leaders";
import { frequencyLabel, listPartners, partnerStatusLabel } from "@/lib/repo/partners";

const csv = (rows: (string | number | null | undefined)[][]) =>
  rows.map((r) => r.map((v) => { const s = String(v ?? ""); return /[",\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : s; }).join(",")).join("\n");

/** CSV / vCard exports for people and attendance (staff only, audited). */
export async function GET(request: NextRequest) {
  const admin = await getAdminSession();
  const type = request.nextUrl.searchParams.get("type");
  if (!admin || !can(admin.role, type === "attendance" ? "attendance" : type === "leaders_vcf" ? "leaders" : type === "partners" ? "partners" : "members")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (type === "partners") {
    const partners = await listPartners();
    await audit(admin.email, "export", "partners", null, { count: partners.length });
    const body = csv([["name", "username", "phone", "email", "status", "pledge", "frequency", "given_total", "given_this_year", "last_gift", "next_follow_up", "assigned_to", "partner_since"],
      ...partners.map((p) => [p.person.full_name, p.person.username, p.person.phone, p.person.email, partnerStatusLabel(p.status), p.pledge_amount, p.frequency ? frequencyLabel(p.frequency) : "", p.given, p.givenThisYear, p.last_gift_at?.slice(0, 10), p.next_follow_up_at?.slice(0, 10), p.assignee, p.created_at.slice(0, 10)])]);
    return new NextResponse(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="flagupjesus-partners.csv"` } });
  }
  if (type === "leaders_vcf") {
    const leaders = await leaderPeople();
    await audit(admin.email, "export", "leaders_vcf", null, { count: leaders.length });
    return new NextResponse(toVcf(leaders), { headers: { "Content-Type": "text/vcard; charset=utf-8", "Content-Disposition": `attachment; filename="flagupjesus-leaders.vcf"` } });
  }
  let body: string;
  if (type === "vcf") {
    const status = request.nextUrl.searchParams.get("status");
    const people = (await listPeople()).filter((p) => (status ? p.status === status : p.status === "member"));
    await audit(admin.email, "export", "contacts_vcf", null, { count: people.length });
    return new NextResponse(toVcf(people), { headers: { "Content-Type": "text/vcard; charset=utf-8", "Content-Disposition": `attachment; filename="flagupjesus-contacts.vcf"` } });
  }
  if (type === "attendance") {
    const serviceId = request.nextUrl.searchParams.get("serviceId");
    const rows = await db().list("attendance", serviceId ? { where: { service_id: serviceId } } : {});
    const people = await peopleById(); const services = new Map((await db().list("services")).map((s) => [s.id, s]));
    body = csv([["service", "service_date", "name", "username", "phone", "status", "checked_in_at", "method"], ...rows.map((a) => {
      const p = people.get(a.person_id); const s = services.get(a.service_id);
      return [s?.title, s?.starts_at, p?.full_name, p?.username, p?.phone, p?.status, a.checked_in_at, a.check_in_method];
    })]);
  } else {
    const people = await listPeople();
    body = csv([["code", "name", "username", "phone", "email", "birthday", "address", "first_timer", "status", "first_visit", "joined"], ...people.map((p) => [p.person_code, p.full_name, p.username, p.phone, p.email, p.birthday, p.address, p.first_timer === true ? "yes" : p.first_timer === false ? "no" : "", p.status, p.first_visit_at, p.joined_at])]);
  }
  await audit(admin.email, "export", type ?? "people", null);
  return new NextResponse(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="flagupjesus-${type ?? "people"}.csv"` } });
}
