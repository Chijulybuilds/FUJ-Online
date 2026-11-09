"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { FIELD_LABELS, STATUS_LABEL, type Contact, type Decision, type Field, type Mapping } from "@/lib/import/contacts";

type Row = Contact & { decision: Decision };
type Preview = { fileName: string; sheets: string[]; sheetIndex: number; headerRow: number; headers: string[]; mapping: Mapping; rows: Row[]; summary: Record<string, number> };
type Result = { line: number; name: string; outcome: "added" | "skipped" | "failed"; username?: string | null; detail: string };

const FIELDS: Field[] = ["name", "phone", "altPhone", "gender", "address", "email", "birthday", "notes", "source", "needsChecking"];
const CHUNK = 20;
const TONE: Record<Decision["status"], string> = { new: "pill-green", shares: "pill-blue", existing: "pill-gray", duplicate: "pill-gray", no_phone: "pill-amber", no_name: "pill-amber" };

function reason(r: Row) {
  const d = r.decision;
  if (d.status === "existing") return `Already in the database as ${d.matchName}${d.by === "name" ? " (same name)" : ""}`;
  if (d.status === "shares") return `Shares ${d.ownerName}'s number${d.ownerLine ? ` (row ${d.ownerLine})` : ""}`;
  if (d.status === "duplicate") return `Same person as row ${d.ofLine}`;
  return STATUS_LABEL[d.status];
}
const csvCell = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : s; };

/** Upload → preview (who's new, who's already in, family numbers) → import in small batches → report. */
export function Importer() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"all" | "add" | "skip">("all");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function load(f: File, opts: { sheet?: number; mapping?: Mapping } = {}) {
    setBusy(true); setError(""); setResults(null);
    const fd = new FormData(); fd.append("file", f);
    if (opts.sheet !== undefined) fd.append("sheet", String(opts.sheet));
    if (opts.mapping) fd.append("mapping", JSON.stringify(opts.mapping));
    const res = await fetch("/api/admin/import/preview", { method: "POST", body: fd });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(json.error ?? "We couldn't read that file."); if (!json.sheets) setPreview(null); return; }
    setPreview(json);
  }

  const toAdd = useMemo(() => preview?.rows.filter((r) => r.decision.status === "new" || r.decision.status === "shares") ?? [], [preview]);
  const shown = useMemo(() => (preview?.rows ?? []).filter((r) => filter === "all" || (filter === "add" ? toAdd.includes(r) : !toAdd.includes(r))), [preview, filter, toAdd]);

  async function runImport() {
    if (!preview) return;
    // Every row goes (in order) so family members follow the person whose number they share; the server re-checks each batch.
    const all = preview.rows.filter((r) => r.decision.status !== "no_phone" && r.decision.status !== "no_name").map(({ decision: _d, ...c }) => { void _d; return c; });
    const out: Result[] = [];
    setProgress({ done: 0, total: all.length }); setError("");
    for (let i = 0; i < all.length; i += CHUNK) {
      const res = await fetch("/api/admin/import/commit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: preview.fileName, contacts: all.slice(i, i + CHUNK) }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(`${json.error ?? "Import stopped."} ${out.filter((r) => r.outcome === "added").length} were added before it stopped — upload the file again to continue (nobody is added twice).`); break; }
      out.push(...json.results);
      setProgress({ done: Math.min(all.length, i + CHUNK), total: all.length });
    }
    for (const r of preview.rows) if (r.decision.status === "no_phone" || r.decision.status === "no_name") out.push({ line: r.line, name: r.name, outcome: "skipped", detail: STATUS_LABEL[r.decision.status] });
    setResults(out.sort((a, b) => a.line - b.line)); setProgress(null);
  }

  function downloadReport() {
    if (!results) return;
    const csv = [["row", "name", "result", "username", "details"], ...results.map((r) => [r.line, r.name, r.outcome, r.username ?? "", r.detail])].map((r) => r.map(csvCell).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `import-report-${(preview?.fileName ?? "contacts").replace(/\.[^.]+$/, "")}.csv`;
    a.click();
  }

  if (results) {
    const added = results.filter((r) => r.outcome === "added");
    const skipped = results.filter((r) => r.outcome === "skipped");
    const failed = results.filter((r) => r.outcome === "failed");
    return (
      <section className="card p-6" data-testid="import-done">
        <div className="flex items-center gap-3"><span className="success-ring"><CheckCircle2 size={30} /></span><div><h2 className="text-xl font-bold">Import finished</h2><p className="text-sm text-slate-500">{preview?.fileName}</p></div></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-100 p-4"><p className="text-xs text-slate-500">Added</p><p className="text-2xl font-bold text-[var(--ok,#16834a)]" data-testid="import-added">{added.length}</p></div>
          <div className="rounded-xl border border-slate-100 p-4"><p className="text-xs text-slate-500">Skipped (already in, duplicates, no phone)</p><p className="text-2xl font-bold" data-testid="import-skipped">{skipped.length}</p></div>
          <div className="rounded-xl border border-slate-100 p-4"><p className="text-xs text-slate-500">Couldn&apos;t be saved</p><p className={`text-2xl font-bold ${failed.length ? "text-red-600" : ""}`}>{failed.length}</p></div>
        </div>
        {error && <p className="alert alert-err mt-4">{error}</p>}
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary" onClick={downloadReport}><Download size={16} /> Download report (CSV)</button>
          <Link href="/admin/members" className="btn btn-primary">Go to Members</Link>
          <button type="button" className="btn btn-ghost" onClick={() => { setResults(null); setPreview(null); setFile(null); }}>Import another file</button>
        </div>
        <p className="mt-4 text-xs text-slate-500">Everyone added gets their own flag username. People with an email address get the welcome email from Settings → Welcome emails (or the daily job). Notes from the list are saved on each member&apos;s record.</p>
        {failed.length > 0 && <ul className="mt-4 space-y-1 text-sm text-red-700">{failed.map((r) => <li key={r.line}>Row {r.line}: {r.name} — {r.detail}</li>)}</ul>}
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <label
          className="import-drop" data-testid="import-drop"
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("over"); }}
          onDragLeave={(e) => e.currentTarget.classList.remove("over")}
          onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("over"); const f = e.dataTransfer.files[0]; if (f) { setFile(f); void load(f); } }}
        >
          <FileSpreadsheet size={34} className="text-[var(--accent)]" />
          <span className="font-bold">{file ? file.name : "Choose an Excel or CSV file"}</span>
          <span className="text-xs text-slate-500">Drag it here or tap to choose · .xlsx or .csv · first row = headings like Name, Phone, Gender, Address, Email, Notes</span>
          <input ref={input} type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" aria-label="Contact list file" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); void load(f); } }} />
        </label>
        {busy && <p className="mt-4 text-sm text-slate-500">Reading the file and checking it against the database…</p>}
        {error && !progress && <p className="alert alert-err mt-4" data-testid="import-error">{error}</p>}
      </section>

      {preview && !busy && (
        <>
          <section className="card p-6" data-testid="import-preview">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-bold">{preview.rows.length} contacts in “{preview.sheets[preview.sheetIndex]}”</h2>
              {preview.sheets.length > 1 && (
                <label className="label flex items-center gap-2">Sheet
                  <select className="input w-auto" value={preview.sheetIndex} onChange={(e) => file && void load(file, { sheet: Number(e.target.value) })}>{preview.sheets.map((s, i) => <option key={s} value={i}>{s}</option>)}</select>
                </label>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2" data-testid="import-summary">
              <span className="pill pill-green">✚ {preview.summary.new ?? 0} new</span>
              {(preview.summary.shares ?? 0) > 0 && <span className="pill pill-blue">👨‍👩‍👧 {preview.summary.shares} on a family number</span>}
              <span className="pill pill-gray">✓ {preview.summary.existing ?? 0} already in the database</span>
              {(preview.summary.duplicate ?? 0) > 0 && <span className="pill pill-gray">{preview.summary.duplicate} listed twice</span>}
              {(preview.summary.no_phone ?? 0) > 0 && <span className="pill pill-amber">{preview.summary.no_phone} without a phone number</span>}
              {(preview.summary.no_name ?? 0) > 0 && <span className="pill pill-amber">{preview.summary.no_name} without a name</span>}
            </div>
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-semibold text-slate-600">Columns we found (change if something&apos;s wrong)</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {FIELDS.map((f) => (
                  <label key={f} className="label">{FIELD_LABELS[f]}
                    <select className="input mt-1" value={preview.mapping[f] ?? ""} onChange={(e) => {
                      const mapping = { ...preview.mapping }; if (e.target.value === "") delete mapping[f]; else mapping[f] = Number(e.target.value);
                      if (file) void load(file, { sheet: preview.sheetIndex, mapping });
                    }}>
                      <option value="">— not in the file —</option>
                      {preview.headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            </details>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button type="button" className="btn btn-primary" disabled={!toAdd.length || Boolean(progress)} onClick={() => void runImport()} data-testid="import-run">
                <Upload size={16} /> {progress ? `Importing… ${progress.done} of ${progress.total}` : toAdd.length ? `Import ${toAdd.length} ${toAdd.length === 1 ? "person" : "people"}` : "Nothing new to import"}
              </button>
              <span className="text-xs text-slate-500">People already in the database are left exactly as they are — nobody is added twice.</span>
            </div>
            {progress && <div className="import-bar mt-4" aria-label="Import progress"><span style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} /></div>}
          </section>

          <section className="card">
            <div className="tabs border-b border-slate-100 px-5 py-3">
              {([["all", `All (${preview.rows.length})`], ["add", `To add (${toAdd.length})`], ["skip", `Skipped (${preview.rows.length - toAdd.length})`]] as const).map(([v, l]) => <button key={v} type="button" className={`tab ${filter === v ? "active" : ""}`} onClick={() => setFilter(v)}>{l}</button>)}
            </div>
            <div className="table-wrap max-h-[32rem] overflow-y-auto">
              <table className="data-table" data-testid="import-table">
                <thead><tr><th>Row</th><th>Name</th><th>Phone</th><th>Gender</th><th>Address</th><th>What happens</th></tr></thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.line}>
                      <td className="text-slate-400">{r.line}</td>
                      <td className="font-semibold">{r.name || "—"}{r.needsChecking && <span className="pill pill-amber ml-1" title={r.notes ?? ""}>check</span>}</td>
                      <td>{r.phone ?? r.altPhone ?? "—"}{r.phone && r.altPhone && <span className="block text-xs text-slate-400">+ {r.altPhone}</span>}</td>
                      <td>{r.gender ?? "—"}</td>
                      <td className="max-w-[14rem] truncate" title={r.address ?? ""}>{r.address ?? "—"}</td>
                      <td><span className={`pill ${TONE[r.decision.status]}`}>{r.decision.status === "new" ? "add" : r.decision.status === "shares" ? "add · family number" : "skip"}</span><span className="block text-xs text-slate-500">{reason(r)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
