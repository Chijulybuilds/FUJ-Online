import { NextResponse } from "next/server";
import { IS_DEMO_MODE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const mode = IS_DEMO_MODE ? "demo" : "supabase";
  if (IS_DEMO_MODE) {
    return NextResponse.json({ ok: true, app: "FlagUpJesus", mode, database: "not_configured", timestamp: new Date().toISOString() });
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").select("id").limit(0);
    if (error) {
      return NextResponse.json(
        { ok: false, app: "FlagUpJesus", mode, database: "unavailable", databaseErrorCode: error.code ?? "UNKNOWN", timestamp: new Date().toISOString() },
        { status: 503 }
      );
    }

    return NextResponse.json({ ok: true, app: "FlagUpJesus", mode, database: "ready", timestamp: new Date().toISOString() });
  } catch {
    return NextResponse.json(
      { ok: false, app: "FlagUpJesus", mode, database: "unavailable", timestamp: new Date().toISOString() },
      { status: 503 }
    );
  }
}
