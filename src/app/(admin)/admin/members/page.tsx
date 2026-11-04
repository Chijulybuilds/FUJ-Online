"use client";
import { useMemo, useState } from "react";
import { Search, UserPlus, Download } from "lucide-react";
import Link from "next/link";
import { people } from "@/lib/demo-data";
import { PageHeading } from "@/components/ui/page-heading";
export default function MembersPage() {
 const [query,setQuery]=useState("");
 const filtered=useMemo(()=>people.filter(p=>`${p.name} ${p.phone} ${p.id}`.toLowerCase().includes(query.toLowerCase())),[query]);
 return <><PageHeading title="People directory" description="Manage members, visitors and their church records." action={<Link href="/admin/members/new" className="btn btn-primary"><UserPlus size={16}/> Add person</Link>}/><div className="card"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5"><div className="relative w-full max-w-sm"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input className="input pl-9" placeholder="Search by name, phone or ID..." value={query} onChange={e=>setQuery(e.target.value)}/></div><button className="btn btn-secondary" onClick={()=>window.alert("Connect Supabase to export live directory data.")}><Download size={15}/> Export</button></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Person</th><th>Phone</th><th>Type</th><th>Department</th><th>Date added</th><th>Last attendance</th></tr></thead><tbody>{filtered.map(p=><tr key={p.id}><td><div className="font-semibold text-slate-800">{p.name}</div><div className="text-[11px] text-slate-400">{p.id} · {p.email}</div></td><td>{p.phone}</td><td><span className={`pill ${p.status==="Member"?"pill-blue":"pill-amber"}`}>{p.status}</span></td><td>{p.department}</td><td>{p.joined}</td><td>{p.attendance}</td></tr>)}</tbody></table>{filtered.length===0&&<p className="p-8 text-center text-sm text-slate-500">No matching records.</p>}</div></div></>;
}
