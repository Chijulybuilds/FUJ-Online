import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyQrToken } from "@/lib/security/qr-token";

export async function POST(request:Request) {
 try {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return NextResponse.json({error:"Sign in before checking in"},{status:401});
  const body=await request.json() as {token?:string};
  if(!body.token) return NextResponse.json({error:"Token is required"},{status:400});
  const payload=verifyQrToken(body.token);
  if(!payload) return NextResponse.json({error:"QR token is invalid or expired"},{status:400});
  const {data:profile,error:profileError}=await supabase.from("profiles").select("person_id").eq("id",user.id).single();
  if(profileError||!profile?.person_id) return NextResponse.json({error:"No church person record is linked to this account"},{status:403});
  const {data:session,error:sessionError}=await supabase.from("qr_sessions").select("id,service_id,status,opens_at,closes_at").eq("id",payload.sessionId).single();
  if(sessionError||!session||session.status!=="active") return NextResponse.json({error:"Service check-in is closed"},{status:409});
  const now=new Date();
  if((session.opens_at&&now<new Date(session.opens_at))||(session.closes_at&&now>new Date(session.closes_at))) return NextResponse.json({error:"Outside the check-in window"},{status:409});
  const {data,error}=await supabase.from("attendance").insert({person_id:profile.person_id,service_id:session.service_id,check_in_method:"qr"}).select("id,checked_in_at").single();
  if(error?.code==="23505") return NextResponse.json({message:"You are already checked in for this service."},{status:200});
  if(error||!data) return NextResponse.json({error:"Check-in could not be recorded"},{status:500});
  return NextResponse.json({message:"Attendance recorded",attendance:data});
 } catch { return NextResponse.json({error:"Check-in failed"},{status:500}); }
}
