import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { importContacts } from "@/lib/repo/contact-import";
import { audit } from "@/lib/repo/audit";

export const maxDuration = 60;

const text = (max: number) => z.string().trim().max(max).nullable();
const contact = z.object({
  line: z.number().int().min(1), name: z.string().trim().max(120), phone: text(20), altPhone: text(20), gender: z.enum(["male", "female"]).nullable(),
  address: text(300), email: text(200), birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), notes: text(2000), source: text(200), needsChecking: z.boolean()
});

/** POST { fileName, contacts (up to 25) } → adds the ones not in the database yet (sent in batches by the import page). */
export async function POST(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin || !can(admin.role, "members")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z.object({ fileName: z.string().trim().min(1).max(200), contacts: z.array(contact).min(1).max(25) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Those rows couldn't be read. Upload the file again." }, { status: 400 });
  const results = await importContacts(parsed.data.contacts, parsed.data.fileName);
  const added = results.filter((r) => r.outcome === "added").length;
  if (added) await audit(admin.email, "people.import", "people", null, { file: parsed.data.fileName, added, rows: results.length });
  return NextResponse.json({ results });
}
