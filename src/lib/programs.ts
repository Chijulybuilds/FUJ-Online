/** The FlagUpJesus motto, as provided by the ministry. */
export const MOTTO = "We Love, We Give, We Change The World";

/**
 * FUJ programmes, as provided by the ministry. Stored as the editable "Programmes & service times"
 * setting (Admin → Settings), one per line: Name|When|Description (description optional).
 * A "When" written as [something] renders as a placeholder until FUJ confirms it.
 */
export const DEFAULT_PROGRAMS = [
  "Word Experience|Every Sunday · 4:30 PM|Our weekly gathering — the Word taught with depth, clarity and power.",
  "Weekly Prayers|Every Wednesday · 5:00 PM|",
  "Connect|Last Sunday of every month|",
  "TFT — The Family Table|Last Saturday of every month|Flag of Jesus Family Table.",
  "Online Global Prayers|Third Friday of every month|",
  "The Forge Retreat|Every quarter|",
  "International Prayer & Missions Conference|Every June · annual|Equipping believers with supernatural empowerment for kingdom advancement.",
  "Jesus Festival|Every November · annual|"
].join("\n");

export type Program = { name: string; when: string; description: string };

export function parsePrograms(value: string | null | undefined): Program[] {
  return (value ?? "").split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const [name, when = "", ...rest] = line.split("|");
    return { name: name.trim(), when: when.trim(), description: rest.join("|").trim() };
  });
}
