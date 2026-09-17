/**
 * Delimited text as spreadsheets write it. Excel separates with a comma, a
 * semicolon or a tab depending on the computer's regional settings, quotes any
 * field that contains the separator (so an allele typed "9,3" survives in a
 * comma-separated file as "9,3"), and may put a byte-order mark or a "sep=;"
 * hint on the first line.
 */

export interface Delimited {
  rows: string[][];
  delimiter: string;
}

const CANDIDATES = ["\t", ";", ","];

/** The separator that occurs most often, outside quotes, on the first line with any text. */
function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n|\r/).find((line) => line.trim() !== "") ?? "";
  let best = ",";
  let bestCount = 0;
  for (const candidate of CANDIDATES) {
    let count = 0;
    let quoted = false;
    for (const char of firstLine) {
      if (char === '"') quoted = !quoted;
      else if (char === candidate && !quoted) count++;
    }
    if (count > bestCount) [best, bestCount] = [candidate, count];
  }
  return best;
}

export function parseDelimited(input: string): Delimited {
  let text = input.replace(/^﻿/, "");

  // Excel's own hint, when present, settles the separator.
  let delimiter: string | null = null;
  const hint = /^sep=(.)\r?\n/i.exec(text);
  if (hint) {
    delimiter = hint[1];
    text = text.slice(hint[0].length);
  }
  delimiter ??= detectDelimiter(text);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  const endField = () => {
    row.push(field.trim());
    field = "";
  };
  const endRow = () => {
    endField();
    if (row.some((cell) => cell !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char !== '"') field += char;
      else if (text[i + 1] === '"') {
        field += '"'; // a doubled quote is a literal one
        i++;
      } else quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) endField();
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      endRow();
    } else field += char;
  }
  endRow();

  return { rows, delimiter };
}

/**
 * Text of a file a laboratory program wrote. Excel and GeneMapper on Windows
 * save in the system code page unless told otherwise, so fall back to it when
 * the bytes are not valid UTF-8; otherwise "Muñoz" arrives as "Mu�oz".
 */
export function decodeExport(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/** Quotes a field only when it needs it. */
export function csvField(value: string): string {
  return /[",;\t\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
