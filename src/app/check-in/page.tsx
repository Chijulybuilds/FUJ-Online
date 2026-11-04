"use client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { BrandLogo } from "@/components/shared/brand-logo";
function CheckInContent(){const params=useSearchParams();const token=params.get("token");return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5"><div className="card w-full max-w-md p-8 text-center"><div className="mb-5 flex items-center justify-between"><Link href="/" aria-label="FlagUpJesus home"><BrandLogo className="h-14 w-20 object-contain"/></Link><ThemeToggle/></div><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">✓</div><h1 className="mt-5 text-2xl font-bold">Church check-in</h1><p className="mt-2 text-sm text-slate-500">Welcome to Flag of Jesus Global Ministry.</p>{token?<div className="mt-5 rounded-xl bg-amber-50 p-4 text-left text-sm text-amber-900">A QR value was detected. This starter QR is a demonstration token and cannot record attendance. Production check-in will validate a signed service token and your verified identity on the server.</div>:<p className="mt-5 text-sm text-slate-500">Scan the QR displayed at the church to begin.</p>}<Link href="/login" className="btn btn-primary mt-6 w-full">Sign in to continue</Link><Link href="/register" className="mt-4 block text-sm font-semibold text-blue-600">First visit? Register here</Link></div></main>}
export default function CheckInPage(){return <Suspense><CheckInContent/></Suspense>}
