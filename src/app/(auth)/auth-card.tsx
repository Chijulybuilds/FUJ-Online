import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function AuthCard({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <main className="checkin-bg flex min-h-screen items-center justify-center px-5 py-12">
      <div className={`card w-full ${wide ? "max-w-xl" : "max-w-md"} p-8 lp-fade`}>
        <div className="mb-8 flex items-center justify-between"><Link href="/" aria-label="FlagUpJesus home"><BrandLogo className="h-14 w-20 object-contain" /></Link><ThemeToggle /></div>
        {children}
      </div>
    </main>
  );
}

export function GoogleButton({ intent, label = "Continue with Google", enabled }: { intent: string; label?: string; enabled: boolean }) {
  if (!enabled) return null;
  return (
    <a href={`/api/auth/google?intent=${intent}`} className="btn btn-secondary w-full py-3">
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
      {label}
    </a>
  );
}

export const ERRORS: Record<string, string> = {
  not_staff: "That Google account isn't on the staff list. Ask a super admin to add your email.",
  oauth_state: "Sign-in session expired. Please try again.",
  oauth_cancelled: "Google sign-in was cancelled.",
  oauth_exchange: "Google sign-in failed. Check the redirect URI configured in Google Cloud.",
  oauth_failed: "Google sign-in failed. Please try again.",
  oauth_unverified: "Your Google email isn't verified.",
  google_not_configured: "Google sign-in isn't configured yet.",
  no_email: "Your Google account didn't share an email address."
};
