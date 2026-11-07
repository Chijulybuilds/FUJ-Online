import "server-only";
import { db } from "@/lib/db";
import type { Announcement, PrayerRequest, Testimony } from "@/lib/db/types";
import { nowIso, uid } from "@/lib/utils";
import { peopleById } from "./people";

/* ---------- Announcements ---------- */
export async function listAnnouncements() {
  return db().list("announcements", { order: { column: "created_at", ascending: false } });
}
export async function publishedAnnouncements(opts: { publicOnly?: boolean } = {}) {
  const rows = await db().list("announcements", { where: { status: "published" }, order: { column: "published_at", ascending: false } });
  return rows
    .filter((a) => !opts.publicOnly || a.is_public)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned));
}
export async function saveAnnouncement(input: Partial<Announcement> & { title: string; body: string }, author: string) {
  const now = nowIso();
  const published = input.status === "published";
  if (input.id) {
    const current = await db().get("announcements", { id: input.id });
    const [row] = await db().update("announcements", { id: input.id }, {
      title: input.title, body: input.body, audience: input.audience ?? "all", status: input.status ?? "draft", pinned: Boolean(input.pinned),
      is_public: Boolean(input.is_public), updated_at: now, published_at: published ? current?.published_at ?? now : current?.published_at ?? null
    });
    return row;
  }
  return db().insert("announcements", {
    id: uid(), title: input.title, body: input.body, audience: input.audience ?? "all", status: input.status ?? "draft",
    published_at: published ? now : null, pinned: Boolean(input.pinned), is_public: Boolean(input.is_public), author, created_at: now, updated_at: now
  });
}
export async function setAnnouncementStatus(id: string, status: Announcement["status"]) {
  const current = await db().get("announcements", { id });
  await db().update("announcements", { id }, { status, updated_at: nowIso(), published_at: status === "published" ? current?.published_at ?? nowIso() : current?.published_at ?? null });
}

/* ---------- Prayer requests ---------- */
export async function submitPrayer(input: {
  person_id?: string | null; request_text: string; visibility: PrayerRequest["visibility"]; is_anonymous?: boolean;
  requester_name?: string | null; requester_contact?: string | null;
}) {
  const now = nowIso();
  return db().insert("prayer_requests", {
    id: uid(), person_id: input.person_id ?? null, request_text: input.request_text.trim(), visibility: input.visibility,
    status: "pending", consent_to_share: input.visibility === "public", requester_name: input.requester_name ?? null,
    requester_contact: input.requester_contact ?? null, is_anonymous: Boolean(input.is_anonymous), prayed_count: 0,
    admin_note: null, assignee: null, on_wall: false, created_at: now, updated_at: now
  });
}
export async function listPrayers() {
  const rows = await db().list("prayer_requests", { order: { column: "created_at", ascending: false } });
  const people = await peopleById(rows.flatMap((r) => (r.person_id ? [r.person_id] : [])));
  return rows.map((r) => ({ ...r, person: r.person_id ? people.get(r.person_id) ?? null : null }));
}
export async function prayerWall() {
  const rows = await db().list("prayer_requests", { where: { on_wall: true, visibility: "public" }, order: { column: "created_at", ascending: false } });
  const people = await peopleById(rows.flatMap((r) => (r.person_id ? [r.person_id] : [])));
  return rows.filter((r) => r.status !== "closed").map((r) => ({
    ...r,
    displayName: r.is_anonymous ? "A church member" : (r.person_id ? people.get(r.person_id)?.full_name.split(" ")[0] : r.requester_name?.split(" ")[0]) ?? "A friend"
  }));
}
export async function updatePrayer(id: string, patch: Partial<PrayerRequest>) {
  if (patch.on_wall) {
    const row = await db().get("prayer_requests", { id });
    if (row?.visibility !== "public") throw new Error("Only requests shared publicly by the requester can go on the prayer wall.");
  }
  await db().update("prayer_requests", { id }, { ...patch, updated_at: nowIso() });
}
export async function prayedFor(id: string) {
  const row = await db().get("prayer_requests", { id, on_wall: true });
  if (row) await db().update("prayer_requests", { id }, { prayed_count: (row.prayed_count ?? 0) + 1 });
}

/* ---------- Testimonies ---------- */
export async function submitTestimony(input: { person_id: string; title: string; body: string; consent_to_publish: boolean }) {
  return db().insert("testimonies", {
    id: uid(), person_id: input.person_id, title: input.title.trim(), body: input.body.trim(), consent_to_publish: input.consent_to_publish,
    status: "pending", featured: false, published_at: null, reviewer: null, created_at: nowIso()
  });
}
export async function listTestimonies() {
  const rows = await db().list("testimonies", { order: { column: "created_at", ascending: false } });
  const people = await peopleById(rows.flatMap((r) => (r.person_id ? [r.person_id] : [])));
  return rows.map((r) => ({ ...r, person: r.person_id ? people.get(r.person_id) ?? null : null }));
}
export async function publishedTestimonies(publicOnly = false) {
  return (await listTestimonies())
    .filter((t) => t.status === "published" && (!publicOnly || t.consent_to_publish))
    .sort((a, b) => Number(b.featured) - Number(a.featured) || (b.published_at ?? "").localeCompare(a.published_at ?? ""));
}
export async function moderateTestimony(id: string, patch: Partial<Testimony>, reviewer: string) {
  const current = await db().get("testimonies", { id });
  if (!current) return;
  if (patch.status === "published" && !current.consent_to_publish) throw new Error("The author did not consent to publishing this testimony.");
  await db().update("testimonies", { id }, { ...patch, reviewer, published_at: patch.status === "published" ? current.published_at ?? nowIso() : current.published_at });
}
