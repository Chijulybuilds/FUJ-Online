import "server-only";
import { db } from "@/lib/db";
import { nowIso, uid } from "@/lib/utils";

export async function audit(actor: string | null, action: string, entityType: string, entityId: string | null, metadata: Record<string, unknown> = {}) {
  try {
    await db().insert("audit_logs", { id: uid(), actor, action, entity_type: entityType, entity_id: entityId, metadata, created_at: nowIso() });
  } catch (error) {
    console.error("audit log failed", error);
  }
}
