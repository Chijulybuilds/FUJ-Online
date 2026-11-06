import { NextResponse } from "next/server";
import { readLocalFlyer } from "@/lib/storage";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

/** Serves flyers uploaded in local development (production uses Supabase Storage public URLs). */
export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const buf = await readLocalFlyer(name);
  if (!buf) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": TYPES[name.split(".").pop()!], "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
}
