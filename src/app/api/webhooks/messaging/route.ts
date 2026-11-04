import { NextResponse } from "next/server";
export async function POST(){return NextResponse.json({error:"Messaging webhook provider is not configured."},{status:501});}
