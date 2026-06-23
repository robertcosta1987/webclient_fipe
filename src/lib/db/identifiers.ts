// lib/db/identifiers.ts — guard for the ONLY thing interpolated into our SQL:
// column-name lists built from internal constants (never user input). Values are
// always bound with .input(@param). This asserts every interpolated identifier is
// a plain SQL identifier (and, optionally, in an allow-list), so a future edit
// can't turn a constant list into an injection vector. See Art. 46.

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Assert a single SQL identifier (table/column). Throws on anything that isn't
 *  a bare identifier (no spaces, quotes, semicolons, comments, parentheses…). */
export function assertIdent(name: string): string {
  if (typeof name !== "string" || !IDENT.test(name)) {
    throw new Error(`identificador SQL inválido: ${JSON.stringify(name)}`);
  }
  return name;
}

/** Validate a column list and return it joined for interpolation. When `allow`
 *  is given, every column must also be a member of it. Throws otherwise. */
export function safeColumns(cols: readonly string[], allow?: readonly string[]): string {
  for (const c of cols) {
    assertIdent(c);
    if (allow && !allow.includes(c)) throw new Error(`coluna fora da allow-list: ${c}`);
  }
  return cols.join(", ");
}
