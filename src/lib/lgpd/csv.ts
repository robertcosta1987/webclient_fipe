// lib/lgpd/csv.ts — pure CSV serialization for the data export (Art. 18 V,
// portability). No DB / no server-only imports so it is unit-testable. The
// export is multi-section (user, customer, vehicles, consultations…); each
// section becomes a "# <section>" banner followed by its own header + rows.

/** RFC-4180-ish field escaping: wrap in quotes when the value contains a comma,
 *  quote, CR or LF; double any embedded quotes. */
export function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s: string;
  if (typeof value === "object") s = JSON.stringify(value);
  else s = String(value);
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** One table → CSV. Columns are the union of keys across rows (stable order:
 *  first-seen). Empty input yields an empty string. */
export function toCsv(rows: ReadonlyArray<Record<string, unknown>>): string {
  if (!rows.length) return "";
  const cols: string[] = [];
  for (const row of rows) for (const k of Object.keys(row)) if (!cols.includes(k)) cols.push(k);
  const head = cols.map(escapeCsv).join(",");
  const body = rows.map((r) => cols.map((c) => escapeCsv(r[c])).join(",")).join("\n");
  return `${head}\n${body}`;
}

/** A whole export object { section: row | rows | null } → a single CSV document
 *  with "# section" banners. Single-object sections (e.g. the user) are emitted
 *  as a one-row table; null/empty sections are noted as "(vazio)". */
export function exportToCsv(sections: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [name, value] of Object.entries(sections)) {
    parts.push(`# ${name}`);
    if (value === null || value === undefined) {
      parts.push("(vazio)");
    } else if (Array.isArray(value)) {
      parts.push(value.length ? toCsv(value as Record<string, unknown>[]) : "(vazio)");
    } else if (typeof value === "object") {
      parts.push(toCsv([value as Record<string, unknown>]));
    } else {
      parts.push(escapeCsv(value));
    }
    parts.push(""); // blank line between sections
  }
  return parts.join("\n").trimEnd() + "\n";
}
