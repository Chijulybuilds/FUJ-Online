const vEsc = (v: string) => v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

/** vCard 3.0 contacts — import on the church phone to build WhatsApp broadcast lists / groups. */
export function toVcf(people: { full_name: string; normalized_phone: string; email: string | null; username: string | null }[]) {
  return people.map((p) => {
    const parts = p.full_name.trim().split(/\s+/);
    const last = parts.length > 1 ? parts.slice(-1)[0] : "";
    const first = parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0];
    return [
      "BEGIN:VCARD", "VERSION:3.0", `FN:${vEsc(`${p.full_name} (FUJ)`)}`, `N:${vEsc(last)};${vEsc(first)};;;`,
      `TEL;TYPE=CELL:${p.normalized_phone}`, ...(p.email ? [`EMAIL:${vEsc(p.email)}`] : []),
      `NOTE:${vEsc(`FlagUpJesus · username ${p.username ?? "-"}`)}`, "CATEGORIES:FlagUpJesus", "END:VCARD"
    ].join("\r\n");
  }).join("\r\n") + "\r\n";
}
