import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { readSpreadsheet } from "@/lib/import/spreadsheet";
import { detectColumns, toContacts, type Mapping } from "@/lib/import/contacts";
import { previewImport } from "@/lib/repo/contact-import";

export const maxDuration = 60;

/**
 * POST multipart { file, sheet?, mapping? } → the contacts found in an Excel / CSV file and what would happen to each
 * (added / already in the database / family number / skipped). Nothing is saved.
 */
export async function POST(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin || !can(admin.role, "members")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Choose an Excel (.xlsx) or CSV file." }, { status: 400 });
  let sheets;
  try {
    sheets = readSpreadsheet(file.name, Buffer.from(await file.arrayBuffer()));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "We couldn't read that file." }, { status: 400 });
  }
  if (!sheets.length) return NextResponse.json({ error: "That file has no sheets with data." }, { status: 400 });
  // The chosen sheet, or the first one that looks like a contact list.
  const requested = Number(form?.get("sheet"));
  const sheetIndex = Number.isInteger(requested) && sheets[requested] ? requested : Math.max(0, sheets.findIndex((s) => detectColumns(s.rows).headerRow >= 0));
  const sheet = sheets[sheetIndex];
  const detected = detectColumns(sheet.rows);
  let mapping: Mapping = detected.mapping;
  const custom = form?.get("mapping");
  if (typeof custom === "string" && custom) {
    try { mapping = Object.fromEntries(Object.entries(JSON.parse(custom) as Record<string, number>).filter(([, v]) => Number.isInteger(v) && v >= 0)); } catch { /* keep detected */ }
  }
  const headerRow = detected.headerRow >= 0 ? detected.headerRow : 0;
  if (mapping.name === undefined && mapping.firstName === undefined) return NextResponse.json({ error: "We couldn't find a Name column. Make sure the first row has headings like “Name” and “Phone”.", sheets: sheets.map((s) => s.name), sheetIndex, headers: sheet.rows[headerRow] ?? [] }, { status: 422 });
  const contacts = toContacts(sheet.rows, headerRow, mapping);
  const rows = await previewImport(contacts);
  const summary = rows.reduce<Record<string, number>>((acc, r) => { acc[r.decision.status] = (acc[r.decision.status] ?? 0) + 1; return acc; }, {});
  return NextResponse.json({ fileName: file.name, sheets: sheets.map((s) => s.name), sheetIndex, headerRow, headers: sheet.rows[headerRow] ?? [], mapping, rows, summary });
}
