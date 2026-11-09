import "server-only";
import { inflateRawSync } from "node:zlib";

/**
 * Minimal, dependency-free reader for contact lists: Excel .xlsx (a zip of XML files) and .csv.
 * Returns every sheet as rows of trimmed text cells. Formulas give their saved value; styles are ignored.
 */
export type Sheet = { name: string; rows: string[][] };

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 5000;

/* ------------------------------------------------------------------ zip */
function unzip(buf: Buffer): Map<string, Buffer> {
  // End of central directory: signature 0x06054b50, within the last 64 KiB.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("not a zip file");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map<string, Buffer>();
  for (let n = 0; n < count && p + 46 <= buf.length; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("bad zip directory");
    const method = buf.readUInt16LE(p + 10);
    const compressed = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    p += 46 + nameLen + extraLen + commentLen;
    if (!/^(xl\/|\[Content_Types\])/.test(name) || size > MAX_BYTES * 4) continue;
    if (buf.readUInt32LE(local) !== 0x04034b50) throw new Error("bad zip entry");
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + compressed);
    files.set(name, method === 0 ? Buffer.from(data) : method === 8 ? inflateRawSync(data, { maxOutputLength: MAX_BYTES * 8 }) : Buffer.alloc(0));
  }
  return files;
}

/* ------------------------------------------------------------------ xml helpers */
const decode = (s: string) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
/** All text inside <t>…</t> runs of an element (rich text has several). */
const texts = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g)].map((m) => decode(m[1] ?? "")).join("");
const attr = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
const colIndex = (ref: string) => { let n = 0; for (const ch of ref.replace(/\d+/g, "")) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };

function readXlsx(buf: Buffer): Sheet[] {
  const files = unzip(buf);
  const str = (name: string) => files.get(name)?.toString("utf8") ?? "";
  const shared = [...str("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1]));
  // Sheet names and order from the workbook; their files from the relationships.
  const rels = new Map([...str("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b[^>]*>/g)].map((m) => [attr(m[0], "Id") ?? "", attr(m[0], "Target") ?? ""]));
  const sheets: Sheet[] = [];
  for (const m of str("xl/workbook.xml").matchAll(/<sheet\b[^>]*>/g)) {
    const target = rels.get(attr(m[0], "r:id") ?? "") ?? "";
    const path = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
    const xml = str(path);
    if (!xml) continue;
    const rows: string[][] = [];
    for (const r of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>|<row\b[^>]*\/>/g)) {
      if (rows.length >= MAX_ROWS) break;
      const cells: string[] = [];
      for (const c of (r[1] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const tag = `<c${c[1]}>`; const body = c[2] ?? "";
        const ref = attr(tag, "r"); const type = attr(tag, "t");
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        let value = "";
        if (type === "s") value = shared[Number(v)] ?? "";
        else if (type === "inlineStr") value = texts(body);
        else if (type === "b") value = v === "1" ? "TRUE" : "FALSE";
        else value = v !== undefined ? decode(v) : "";
        const i = ref ? colIndex(ref) : cells.length;
        while (cells.length < i) cells.push("");
        cells[i] = value.trim();
      }
      rows.push(cells);
    }
    sheets.push({ name: decode(attr(m[0], "name") ?? `Sheet ${sheets.length + 1}`), rows });
  }
  return sheets;
}

/* ------------------------------------------------------------------ csv */
function readCsv(text: string): Sheet[] {
  const src = text.replace(/^﻿/, "");
  const delimiter = (src.split("\n")[0].match(/;/g)?.length ?? 0) > (src.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let i = 0; i < src.length && rows.length < MAX_ROWS; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) { row.push(cell.trim()); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && src[i + 1] === "\n") i++; row.push(cell.trim()); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  return [{ name: "CSV", rows: rows.filter((r) => r.some(Boolean)) }];
}

/** Reads an uploaded .xlsx or .csv file. Throws a plain-English error for anything else. */
export function readSpreadsheet(fileName: string, buf: Buffer): Sheet[] {
  if (buf.length > MAX_BYTES) throw new Error("That file is too big (5 MB at most). Split the list into smaller files.");
  const isZip = buf.length > 4 && buf.readUInt32LE(0) === 0x04034b50;
  if (isZip) {
    try { return readXlsx(buf); } catch { throw new Error("We couldn't read that Excel file. Open it in Excel and save it again as .xlsx (or as CSV), then try again."); }
  }
  if (/\.xls$/i.test(fileName)) throw new Error("That's an old Excel (.xls) file. Open it in Excel and save it as .xlsx or CSV, then try again.");
  return readCsv(buf.toString("utf8"));
}
