"use client";

import { PageHeading } from "@/components/ui/page-heading";
import { followUps } from "@/lib/demo-data";
export default function PastoralCarePage() {
 return <><PageHeading title="Pastoral care" description="A follow-up queue for people who may appreciate a personal check-in."/><div className="card"><div className="table-wrap"><table className="data-table"><thead><tr><th>Person</th><th>Reason</th><th>Priority</th><th>Assigned to</th><th>Action</th></tr></thead><tbody>{followUps.map(f=><tr key={f.name}><td className="font-semibold">{f.name}</td><td>{f.reason}</td><td><span className={`pill ${f.priority==="High"?"pill-amber":"pill-gray"}`}>{f.priority}</span></td><td>{f.assigned}</td><td><button className="btn btn-secondary" onClick={()=>alert("Connect the pastoral-care task workflow to Supabase.")}>Open task</button></td></tr>)}</tbody></table></div></div><p className="mt-4 text-xs text-slate-500">Absence flags are prompts for human review, not proof that a person has left the church.</p></>;
}
