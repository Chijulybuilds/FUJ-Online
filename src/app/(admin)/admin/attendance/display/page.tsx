"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import Image from "next/image";
import { PageHeading } from "@/components/ui/page-heading";
import { IS_DEMO_MODE } from "@/lib/constants";
export default function AttendanceDisplayPage() {
 const [seconds,setSeconds]=useState(20);
 const [qr,setQr]=useState("");
 const [error,setError]=useState("");
 useEffect(()=>{
  let active=true;
  const refresh=async()=>{
   try {
    let token:string;
    let expiresIn=20;
    if(IS_DEMO_MODE) {
     token=`FLAGUPJESUS-DEMO-${Math.floor(Date.now()/20000)}`;
    } else {
     const response=await fetch("/api/attendance/token");
     const result=await response.json() as {token?:string;expiresIn?:number;error?:string};
     if(!response.ok||!result.token) throw new Error(result.error??"Unable to load an attendance QR.");
     token=result.token;
     expiresIn=result.expiresIn??20;
    }
    const image=await QRCode.toDataURL(`${window.location.origin}/check-in?token=${encodeURIComponent(token)}`,{width:300,margin:2});
    if(active) {
     setQr(image);
     setError("");
     setSeconds(expiresIn);
    }
   } catch (cause) {
    if(active) {
     setQr("");
     setError(cause instanceof Error?cause.message:"Unable to load an attendance QR.");
     setSeconds(20);
    }
   }
  };
  void refresh();
  const timer=setInterval(()=>setSeconds(current=>{
   if(current<=1) {
    void refresh();
    return 20;
   }
   return current-1;
  }),1000);
  return()=>{active=false;clearInterval(timer);};
 },[]);
 return <><PageHeading title="Attendance QR display" description="Project this page on the church screen during an active service."/><div className="brand-panel mx-auto max-w-xl rounded-3xl p-8 text-center shadow-xl"><p className="text-sm font-semibold tracking-widest text-blue-200">FLAG OF JESUS GLOBAL MINISTRY</p><h2 className="mt-3 text-3xl font-bold">Scan to check in</h2><p className="mt-2 text-sm text-slate-300">Welcome! Scan this code with your phone to record your attendance.</p><div className="mx-auto my-7 flex h-[330px] w-[330px] max-w-full items-center justify-center rounded-2xl bg-white p-3">{qr?<Image src={qr} alt={IS_DEMO_MODE?"Demonstration attendance QR code":"Attendance QR code"} width={300} height={300} unoptimized className="h-full w-full"/>:<span className="px-4 text-sm text-slate-600">{error||"Preparing QR…"}</span>}</div>{IS_DEMO_MODE?<><p className="text-sm text-blue-200">Demo QR refreshes in <strong className="text-white">{seconds}s</strong></p><p className="mt-5 text-xs text-slate-400">DEVELOPMENT PREVIEW · NOT VALID FOR REAL ATTENDANCE</p></>:qr?<p className="text-sm text-blue-200">QR refreshes in <strong className="text-white">{seconds}s</strong></p>:<p className="mt-5 text-xs text-slate-400">Sign in as an administrator and activate a QR session to display a live code.</p>}</div>{IS_DEMO_MODE&&<div className="mx-auto mt-5 max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Important:</strong> This display uses a demo token. Production QR issuance requires an authenticated administrator and an active service session. Do not use demo QR codes to record real attendance.</div>}</>;
}
