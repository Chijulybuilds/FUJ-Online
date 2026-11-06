import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { MAX_FLYER_BYTES, saveFlyer, sniffImage } from "@/lib/storage";
import { audit } from "@/lib/repo/audit";

/** Flyer upload for broadcasts (multipart "file"; JPG/PNG/WebP/GIF up to 5 MB). */
export async function POST(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin || !(can(admin.role, "messaging") || can(admin.role, "announcements"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image." }, { status: 400 });
  if (file.size > MAX_FLYER_BYTES) return NextResponse.json({ error: "Flyer must be 5 MB or smaller." }, { status: 413 });
  const buf = Buffer.from(await file.arrayBuffer());
  if (!sniffImage(buf)) return NextResponse.json({ error: "Use a JPG, PNG, WebP or GIF image." }, { status: 415 });
  try {
    const url = await saveFlyer(buf);
    await audit(admin.name, "flyer.upload", "broadcasts", null, { bytes: buf.length });
    return NextResponse.json({ url });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
