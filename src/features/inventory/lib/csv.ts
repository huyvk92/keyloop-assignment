/**
 * Minimal RFC 4180 CSV writer for the client-side export (ADR-010, T-043). Framework-free.
 *
 * - Records end with CRLF (also the last one, which RFC 4180 allows).
 * - A field containing a comma, a double quote, CR or LF is wrapped in double quotes and its
 *   quotes are doubled.
 * - The text starts with a UTF-8 byte-order mark, so Excel opens it as UTF-8 and Vietnamese
 *   characters stay intact (AC-013.3); other tools ignore the mark.
 * - Text cells get a formula-injection guard (AC-013.4, NFR-03, OWASP "CSV injection"):
 *   spreadsheet software runs a cell that starts with `=`, `+`, `-` or `@` as a formula (and some
 *   also after a leading tab or CR), so such text is prefixed with an apostrophe, which makes it
 *   literal text and is not displayed by Excel. A stored "-5" therefore exports as "'-5"; that is
 *   accepted, because every text cell comes from people or stored data we don't control.
 * - Numeric cells (`number` or `numeric()`) are written as is, unguarded: they are produced by
 *   our own code from validated numbers, never from free text, so they can't carry a formula, and
 *   a guard would turn them into text in the spreadsheet.
 */

/** UTF-8 byte-order mark (U+FEFF); encoded as EF BB BF by the Blob. */
export const CSV_BOM = '﻿';
const CRLF = '\r\n';

/** A pre-formatted decimal number written verbatim (e.g. "25990.00"), see `numeric`. */
export type CsvNumeric = { readonly numeric: string };
/** Text (guarded, quoted when needed), a number, a pre-formatted decimal, or empty. */
export type CsvCell = string | number | CsvNumeric | null;
export type CsvRow = readonly CsvCell[];

const DECIMAL = /^-?\d+(\.\d+)?$/;

/** Marks a decimal string as a number cell. Only plain decimals are accepted (no `1e3`, `,`). */
export function numeric(value: string): CsvNumeric {
  if (!DECIMAL.test(value)) throw new RangeError(`Not a plain decimal: ${value}`);
  return { numeric: value };
}

/** Characters that make spreadsheet software treat the cell as a formula (AC-013.4). */
const FORMULA_START = new Set(['=', '+', '-', '@', '\t', '\r']);

/** Prefixes text that a spreadsheet would run as a formula with `'` (see the module comment). */
export function guardFormula(text: string): string {
  return FORMULA_START.has(text.charAt(0)) ? `'${text}` : text;
}

const NEEDS_QUOTES = /[",\r\n]/;

function quote(field: string): string {
  return NEEDS_QUOTES.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
}

function writeCell(cell: CsvCell): string {
  if (cell === null) return '';
  if (typeof cell === 'number') {
    if (!Number.isFinite(cell)) throw new RangeError(`Not a finite number: ${cell}`);
    return String(cell);
  }
  if (typeof cell === 'object') return cell.numeric;
  return quote(guardFormula(cell));
}

/** The whole file: BOM, then one CRLF-terminated record per row. */
export function toCsv(rows: readonly CsvRow[]): string {
  return CSV_BOM + rows.map((row) => row.map(writeCell).join(',') + CRLF).join('');
}
