// placa/normalize.ts — single source of truth for plate handling.
//
// Brazilian plate formats accepted by this app:
//   - pre-Mercosul: ABC1234 (3 letters, 4 digits)
//   - Mercosul:     ABC1D23 (3 letters, 1 digit, 1 letter, 2 digits)
//
// Storage / API form: exactly 7 chars, uppercase, no hyphen, no whitespace.
// We strip any hyphen or whitespace the user might paste in. We never
// render hyphens back, anywhere.

export const PLATE_OLD = /^[A-Z]{3}\d{4}$/;
export const PLATE_MERCOSUL = /^[A-Z]{3}\d[A-Z]\d{2}$/;

/** Normalize a free-typed plate to its storage form, or return "" if empty. */
export function normalizePlaca(input: string): string {
  return (input || "")
    .toUpperCase()
    .replace(/[\s \-_.]/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

export function isValidPlaca(plate: string): boolean {
  return PLATE_OLD.test(plate) || PLATE_MERCOSUL.test(plate);
}
