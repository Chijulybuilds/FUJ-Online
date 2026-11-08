import type { StaffRole } from "@/lib/db/types";

export type Area =
  | "dashboard" | "members" | "leaders" | "services" | "attendance" | "care" | "messaging" | "inbox" | "announcements"
  | "prayer" | "testimonies" | "giving" | "partners" | "reports" | "settings" | "staff";

const ALL: Area[] = ["dashboard", "members", "leaders", "services", "attendance", "care", "messaging", "inbox", "announcements", "prayer", "testimonies", "giving", "partners", "reports", "settings"];

export const ROLE_ACCESS: Record<StaffRole, Area[]> = {
  super_admin: [...ALL, "staff"],
  admin: ALL,
  pastor: ALL,
  pastoral_worker: ["dashboard", "members", "care", "messaging", "inbox", "prayer", "testimonies"],
  finance_admin: ["dashboard", "giving", "partners", "reports"],
  department_leader: ["dashboard", "members", "services", "attendance"]
};

export const ROLE_LABELS: Record<StaffRole, string> = {
  super_admin: "Super admin",
  admin: "Administrator",
  pastor: "Pastor",
  pastoral_worker: "Pastoral worker",
  finance_admin: "Finance admin",
  department_leader: "Usher"
};

export function can(role: StaffRole, area: Area) {
  return ROLE_ACCESS[role]?.includes(area) ?? false;
}
