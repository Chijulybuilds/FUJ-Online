"use client";
import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { IS_DEMO_MODE } from "@/lib/constants";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
export default function LoginPage() {
 const [phone,setPhone]=useState(""); const [message,setMessage]=useState(""); const [loading,setLoading]=useState(false);
 async function submit(e:React.FormEvent) { e.preventDefault();setMessage("");if(IS_DEMO_MODE){setMessage("Demo mode is active. Supabase is not connected yet.");return;}setLoading(true);try{const supabase=createClient();const {error}=await supabase.auth.signInWithOtp({phone});if(error)throw error;setMessage("OTP sent. Complete verification using your configured Supabase Auth flow.");}catch(err){setMessage(err instanceof Error?err.message:"Unable to send OTP.");}finally{setLoading(false);}}
 return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12"><div className="card w-full max-w-md p-8"><div className="mb-8 flex items-center justify-between"><Link href="/" aria-label="FlagUpJesus home"><BrandLogo className="h-16 w-24 object-contain"/></Link><ThemeToggle/></div><h1 className="text-2xl font-bold">Welcome back</h1><p className="mt-2 text-sm text-slate-500">Sign in with your registered phone number.</p><form className="mt-7 space-y-4" onSubmit={submit}><label className="block text-sm font-medium">Phone number<input className="input mt-2" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+234..." required/></label><button className="btn btn-primary w-full" disabled={loading}>{loading?"Sending...":"Continue with OTP"}</button></form>{message&&<p className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{message}</p>}<p className="mt-6 text-center text-sm text-slate-500">New to our church? <Link className="font-semibold text-blue-600" href="/register">Register here</Link></p><Link href="/admin" className="mt-5 block text-center text-xs text-slate-400">Preview admin dashboard</Link></div></main>;
}
