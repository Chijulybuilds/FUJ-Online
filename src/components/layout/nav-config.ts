import type { Area } from "@/lib/auth/roles";
export type NavLink = { label: string; href: string; icon: string; area: Area };
export const NAV_GROUPS: { label: string; links: NavLink[] }[] = [
  { label: "OVERVIEW", links: [
    { label: "Dashboard", href: "/admin", icon: "home", area: "dashboard" },
    { label: "Members", href: "/admin/members", icon: "users", area: "members" },
    { label: "Leaders", href: "/admin/leaders", icon: "leaders", area: "leaders" },
    { label: "Children & teens", href: "/admin/children", icon: "children", area: "members" },
    { label: "Services", href: "/admin/services", icon: "calendar", area: "services" },
    { label: "Check-in desk", href: "/admin/attendance/desk", icon: "check", area: "attendance" },
    { label: "Attendance", href: "/admin/attendance", icon: "qr", area: "attendance" }
  ] },
  { label: "MINISTRY", links: [
    { label: "First timers", href: "/admin/first-timers", icon: "sparkles", area: "first_timers" },
    { label: "Missed Sundays", href: "/admin/absent", icon: "heart", area: "first_timers" },
    { label: "Partners", href: "/admin/partners", icon: "partner", area: "partners" },
    { label: "Broadcasts", href: "/admin/messaging", icon: "send", area: "messaging" },
    { label: "Inbox", href: "/admin/inbox", icon: "inbox", area: "inbox" },
    { label: "Announcements", href: "/admin/announcements", icon: "megaphone", area: "announcements" },
    { label: "Prayer requests", href: "/admin/prayer-requests", icon: "message", area: "prayer" },
    { label: "Testimonies", href: "/admin/testimonies", icon: "book", area: "testimonies" }
  ] },
  { label: "MANAGEMENT", links: [
    { label: "Giving", href: "/admin/giving", icon: "money", area: "giving" },
    { label: "Reports", href: "/admin/reports", icon: "chart", area: "reports" },
    { label: "Settings", href: "/admin/settings", icon: "settings", area: "settings" }
  ] }
];
