import { canonicalLocus, SEX_MARKER, type LocusId } from "@/lib/genetics";
import type { SubjectRole } from "@/lib/store/types";
import { csvField, parseDelimited } from "./csv";

/**
 * The profile table FilBio reads and hands out as a template. It is laid out
 * like the entry grid, one row per marker and two columns per person:
 *
 *     Marcador,Madre biológica 1,Madre biológica 2,Hijo(a) 1,Hijo(a) 2,Presunto padre 1,Presunto padre 2
 *     D8S1179,13,14,13,15,12,15
 *     AMEL,X,X,X,Y,X,Y
 *
 * Columns are recognised by what their header says, in Spanish or English, so a
 * laboratory can rename or reorder them, leave people out, or keep its own codes
 * (MB, HP, PP). A person whose columns are all empty is not imported.
 */

export type Profiles = Partial<Record<SubjectRole, Record<string, [string, string]>>>;

export interface ProfileTable {
  profiles: Profiles;
  /** Autosomal markers recognised, in file order. */
  markers: LocusId[];
  unknownMarkers: string[];
  unknownColumns: string[];
  problems: Array<{ kind: "noHeader" } | { kind: "noRows" }>;
}

const strip = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

const CODES: Record<string, SubjectRole> = {
  PP: "alleged", PM: "alleged", AF: "alleged", AM: "alleged",
  HP: "child", H: "child", C: "child",
  MB: "known", PB: "known", M: "known", F: "known", P: "known",
};

/**
 * Whose column this is. "Presunto padre" must be read before "padre", and a
 * bare word for a parent means the known one: in a paternity case the mother.
 */
export function roleOfHeader(header: string): SubjectRole | null {
  const text = strip(header);
  if (/PRESUNT|SUPUEST|ALLEGED/.test(text)) return "alleged";
  if (/HIJ|CHILD|MENOR/.test(text)) return "child";
  if (/MADRE|MOTHER|PADRE|FATHER|BIOLOG|CONOCID|KNOWN/.test(text)) return "known";
  // Laboratory codes, alone or with the allele number: "PP", "HP 2", "MB1".
  const code = /^([A-Z]{1,2})[\s_.-]*(?:ALELO|ALLELE)?[\s_.-]*[12]?$/.exec(text.trim());
  return (code && CODES[code[1]]) || null;
}

const isMarkerHeader = (header: string) => /^(MARCADOR|MARKER|LOCUS|LOCI|STR)$/.test(strip(header).trim());

export function parseProfileTable(text: string): ProfileTable {
  const result: ProfileTable = { profiles: {}, markers: [], unknownMarkers: [], unknownColumns: [], problems: [] };
  const { rows } = parseDelimited(text);

  // The header is the first of the opening rows that names at least one person.
  const headerAt = rows.slice(0, 6).findIndex((row) => row.some((cell) => roleOfHeader(cell) !== null));
  if (headerAt < 0) return { ...result, problems: [{ kind: "noHeader" }] };

  const header = rows[headerAt];
  const markerAt = Math.max(0, header.findIndex(isMarkerHeader));
  const columns: Partial<Record<SubjectRole, number[]>> = {};

  header.forEach((cell, index) => {
    if (index === markerAt || cell === "") return;
    const role = roleOfHeader(cell);
    if (!role) {
      result.unknownColumns.push(cell);
      return;
    }
    const slots = (columns[role] ??= []);
    // "… 2" names the second allele outright; otherwise, and when that slot is
    // already taken (two columns headed "PP-0121"), columns fill in order.
    const firstFree = slots[0] === undefined ? 0 : slots[1] === undefined ? 1 : -1;
    const numbered = /([12])\D*$/.exec(cell)?.[1];
    const wanted = numbered ? Number(numbered) - 1 : firstFree;
    const slot = wanted >= 0 && slots[wanted] === undefined ? wanted : firstFree;
    if (slot >= 0) slots[slot] = index;
    else result.unknownColumns.push(cell);
  });

  const collected: Profiles = {};
  for (const row of rows.slice(headerAt + 1)) {
    const name = row[markerAt] ?? "";
    if (name === "") continue;
    const marker = /^amel/i.test(name) ? SEX_MARKER : canonicalLocus(name);
    if (!marker) {
      if (!result.unknownMarkers.includes(name)) result.unknownMarkers.push(name);
      continue;
    }
    if (marker !== SEX_MARKER && !result.markers.includes(marker)) result.markers.push(marker);

    for (const [role, slots] of Object.entries(columns) as Array<[SubjectRole, number[]]>) {
      const read = (slot: number) => (slots[slot] === undefined ? "" : (row[slots[slot]] ?? "")).replace(/^-$/, "");
      const pair: [string, string] = [read(0), read(1)];
      (collected[role] ??= {})[marker] = marker === SEX_MARKER ? [pair[0].toUpperCase(), pair[1].toUpperCase()] : pair;
    }
  }

  // Someone with no allele anywhere was left blank on purpose: a duo on a trio template.
  for (const [role, profile] of Object.entries(collected) as Array<[SubjectRole, Record<string, [string, string]>]>) {
    if (Object.values(profile).some(([a, b]) => a !== "" || b !== "")) result.profiles[role] = profile;
  }
  if (Object.keys(result.profiles).length === 0) result.problems.push({ kind: "noRows" });
  return result;
}

/** Cells holding something that is not an allele ("OL", "?", "12/13"), for the analyst to fix. */
export function invalidCalls(profile: Record<string, [string, string]>): Array<{ marker: string; alleles: string[] }> {
  const found: Array<{ marker: string; alleles: string[] }> = [];
  for (const [marker, pair] of Object.entries(profile)) {
    const valid = marker === SEX_MARKER ? /^[XY]$/i : /^\d{1,3}([.,]\d)?$/;
    const typed = pair.filter((cell) => cell !== "");
    if (typed.some((cell) => !valid.test(cell))) found.push({ marker, alleles: typed });
  }
  return found;
}

/**
 * The template, or with `values` a filled table. Written for Excel: a byte-order
 * mark so that accents survive, and CRLF line ends.
 */
export function buildProfileTable({
  loci,
  roles,
  labels,
  markerLabel,
  values = {},
}: {
  loci: LocusId[];
  roles: SubjectRole[];
  labels: Record<SubjectRole, string>;
  markerLabel: string;
  values?: Profiles;
}): string {
  const header = [markerLabel, ...roles.flatMap((role) => [`${labels[role]} 1`, `${labels[role]} 2`])];
  const lines = [header, ...[...loci, SEX_MARKER].map((marker) => [
    marker,
    ...roles.flatMap((role) => values[role]?.[marker] ?? ["", ""]),
  ])];
  return `﻿${lines.map((line) => line.map(csvField).join(",")).join("\r\n")}\r\n`;
}
