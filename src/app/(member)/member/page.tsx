import Link from "next/link";
import { CalendarCheck, Heart, Megaphone, MessageSquare, Sparkles, Wallet } from "lucide-react";
import { requireMember } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { attendanceForPerson, upcomingService } from "@/lib/repo/services";
import { memberMessages } from "@/lib/repo/messaging";
import { publishedAnnouncements } from "@/lib/repo/content";
import { CopyButton } from "@/components/shared/copy-button";
import { formatDate, formatDateTime } from "@/lib/utils";

export default async function MemberHome({ searchParams }: { searchParams: Promise<{ password?: string }> }) {
  const { password } = await searchParams;
  const me = await requireMember();
  const person = (await db().get("people", { id: me.personId }))!;
  const [attendance, next, messages, news] = await Promise.all([
    attendanceForPerson(person.id), upcomingService(), memberMessages(person.id),
    publishedAnnouncements()
  ]);
  const unread = messages.filter((m) => !m.read_at);
  const shortcuts = [
    { label: "Messages", href: "/member/messages", Icon: MessageSquare, note: unread.length ? `${unread.length} unread` : "All caught up" },
    { label: "Prayer requests", href: "/member/prayer-requests", Icon: Heart, note: "We'll pray with you" },
    { label: "Share a testimony", href: "/member/testimonies", Icon: Sparkles, note: "Tell what God did" },
    { label: "My attendance", href: "/member/attendance", Icon: CalendarCheck, note: `${attendance.length} services` },
    { label: "Church updates", href: "/member/announcements", Icon: Megaphone, note: `${news.length} announcements` },
    { label: "Giving", href: "/member/giving", Icon: Wallet, note: "Tithes & offerings" }
  ];
  return (
    <>
      <div className="brand-panel relative overflow-hidden rounded-3xl p-8">
        <div className="lp-aurora opacity-40"><span /><span /><span /></div>
        <p className="text-sm text-red-200">Welcome home</p>
        <h1 className="mt-2 text-3xl font-bold">Hi {person.full_name.split(" ")[0]}, God bless you! 🙌</h1>
        <div className="mt-6 inline-flex flex-wrap items-center gap-3 rounded-2xl bg-white/10 p-4">
          <div><p className="text-xs text-slate-300">Your check-in username</p><p className="username-badge text-2xl font-extrabold text-[#ffc7cb]" data-testid="portal-username">{person.username}</p></div>
          <CopyButton value={person.username ?? ""} className="btn lp-btn-glass btn-sm" />
        </div>
        {next && <p className="mt-5 text-sm text-slate-300">Next: <b className="text-white">{next.title}</b> · {formatDateTime(next.starts_at)}</p>}
      </div>
      {password === "set" && <p className="alert alert-ok mt-6" data-testid="password-set">🔐 Your password is set. Next time, sign in with your username (or email) and password — or your phone number, as before.</p>}
      {unread.length > 0 && (
        <Link href="/member/messages" className="alert alert-warn mt-6 block">📬 You have {unread.length} unread message{unread.length === 1 ? "" : "s"} from the church — latest: <b>{unread[0].broadcast.title}</b></Link>
      )}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shortcuts.map(({ Icon, label, href, note }) => (
          <Link key={href} href={href} className="card p-5 transition hover:-translate-y-1"><Icon className="text-blue-600" /><p className="mt-4 font-semibold">{label}</p><p className="mt-1 text-xs text-slate-500">{note}</p></Link>
        ))}
      </div>
      {news.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-bold">Latest from church</h2>
          <div className="grid gap-4 md:grid-cols-2">{news.slice(0, 2).map((a) => <article key={a.id} className="card p-5"><p className="font-semibold">{a.pinned && "📌 "}{a.title}</p><p className="mt-2 line-clamp-3 text-sm text-slate-600">{a.body}</p><p className="mt-3 text-xs text-slate-400">{formatDate(a.published_at)}</p></article>)}</div>
        </section>
      )}
    </>
  );
}
