import { NextResponse } from "next/server";
import { z } from "zod";
import { createQrToken } from "@/lib/security/qr-token";
import { createClient } from "@/lib/supabase/server";

/** Issues a token for the current active session; RLS restricts session reads to admins. */
export async function GET() {
 try {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return NextResponse.json({error:"Unauthorized"},{status:401});
  const now=new Date();
  const {data:session,error}=await supabase.from("qr_sessions")
   .select("id,closes_at")
   .eq("status","active")
   .lte("opens_at",now.toISOString())
   .gte("closes_at",now.toISOString())
   .order("closes_at",{ascending:true})
   .limit(1)
   .maybeSingle();
  if(error) return NextResponse.json({error:"Unable to load active QR session"},{status:500});
  if(!session) return NextResponse.json({error:"No active QR session is available"},{status:404});
  const expiresIn=Math.min(20,Math.floor((new Date(session.closes_at).getTime()-now.getTime())/1000));
  if(expiresIn<1) return NextResponse.json({error:"QR session is closing"},{status:409});
  return NextResponse.json({token:createQrToken(session.id,expiresIn),expiresIn});
 } catch { return NextResponse.json({error:"Unable to issue token"},{status:500}); }
}

/** Issues a short-lived token only for an authenticated admin and active QR session. */
export async function POST(request: Request) {
 try {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return NextResponse.json({error:"Unauthorized"},{status:401});
  const body=await request.json().catch(()=>null);
  const parsed=z.object({sessionId:z.string().uuid()}).safeParse(body);
  if(!parsed.success) return NextResponse.json({error:"A valid sessionId is required"},{status:400});
  const {data:session,error}=await supabase.from("qr_sessions").select("id,status,opens_at,closes_at").eq("id",parsed.data.sessionId).single();
  const now=new Date();
  if(error||!session||session.status!=="active"||now<new Date(session.opens_at)||now>new Date(session.closes_at)) return NextResponse.json({error:"QR session is not active"},{status:409});
  return NextResponse.json({token:createQrToken(session.id,20),expiresIn:20});
 } catch { return NextResponse.json({error:"Unable to issue token"},{status:500}); }
}
