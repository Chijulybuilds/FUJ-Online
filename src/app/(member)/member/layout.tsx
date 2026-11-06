import { MemberShell } from "@/components/layout/member-shell";
import { requireMember } from "@/lib/auth/session";
import { unreadCount } from "@/lib/repo/messaging";
export const dynamic = "force-dynamic";
export default async function Layout({ children }: { children: React.ReactNode }) {
  const me = await requireMember();
  return <MemberShell unread={await unreadCount(me.personId)} name={me.name}>{children}</MemberShell>;
}
