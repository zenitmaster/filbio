import {
  canonicalLocus,
  KITS,
  lociOfKit,
  SEX_MARKER,
  type Kit,
  type LocusId,
  type ParentSex,
} from "@/lib/genetics";
import type { SubjectRole } from "@/lib/store/types";

/**
 * Reads the genotype table exported by Applied Biosystems GeneMapper ID and
 * GeneMapper ID-X (File > Export Table): delimited text with one row per sample
 * and marker.
 *
 *     Sample File   Sample Name   Panel   Marker    Dye   Allele 1   Allele 2   Size 1 ...
 *     A01.hid       HP-0042       ...     D8S1179   B     13         14         ...
 *
 * Which columns are present depends on the table settings saved in GeneMapper,
 * so only three are relied on: a sample column, "Marker" and "Allele n".
 * A homozygote is usually exported with Allele 2 empty.
 */

export interface ImportedSample {
  /** Unique within the file; the same sample name can be injected more than once. */
  key: string;
  name: string;
  file: string;
  /** Name, plus the file when two samples share a name. */
  label: string;
  panel: string;
  /** Alleles in exported order, keyed by canonical marker (or SEX_MARKER). */
  markers: Record<string, string[]>;
}

export type GeneMapperProblem =
  /** No row looks like a GeneMapper header. */
  | { kind: "noHeader" }
  | { kind: "noRows" }
  /** The same sample has two different calls for one marker. */
  | { kind: "conflict"; sample: string; marker: string };

export interface GeneMapperImport {
  samples: ImportedSample[];
  /** Autosomal markers recognised, in the order they first appear. */
  markers: LocusId[];
  /** Markers this tool does not use: Y-STRs, Y indel, quality sentinels. */
  skipped: string[];
  problems: GeneMapperProblem[];
}

const normalise = (header: string) => header.toLowerCase().replace(/[\s_.-]+/g, "");

function splitLine(line: string, delimiter: string): string[] {
  return line.split(delimiter).map((cell) => cell.trim().replace(/^"(.*)"$/, "$1"));
}

export function parseGeneMapper(text: string): GeneMapperImport {
  const result: GeneMapperImport = { samples: [], markers: [], skipped: [], problems: [] };
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);

  // The header is the first line naming both a marker column and an allele column.
  let headerAt = -1;
  let delimiter = "\t";
  for (let i = 0; i < lines.length && headerAt < 0; i++) {
    for (const candidate of ["\t", ";", ","]) {
      const cells = splitLine(lines[i], candidate).map(normalise);
      if (cells.includes("marker") && cells.some((cell) => /^allele\d+$/.test(cell))) {
        headerAt = i;
        delimiter = candidate;
        break;
      }
    }
  }
  if (headerAt < 0) return { ...result, problems: [{ kind: "noHeader" }] };

  const header = splitLine(lines[headerAt], delimiter).map(normalise);
  const column = (...names: string[]) => names.map((name) => header.indexOf(name)).find((index) => index >= 0) ?? -1;
  const nameAt = column("samplename", "sample", "sampleid");
  const fileAt = column("samplefile");
  const panelAt = column("panel");
  const markerAt = column("marker");
  const alleleAt = header
    .map((cell, index) => ({ index, n: Number(/^allele(\d+)$/.exec(cell)?.[1] ?? 0) }))
    .filter((entry) => entry.n > 0)
    .sort((a, b) => a.n - b.n)
    .map((entry) => entry.index);

  const byKey = new Map<string, ImportedSample>();
  const skipped = new Set<string>();

  for (const line of lines.slice(headerAt + 1)) {
    if (line.trim() === "") continue;
    const cells = splitLine(line, delimiter);
    const rawMarker = cells[markerAt] ?? "";
    if (rawMarker === "") continue;

    const file = fileAt >= 0 ? (cells[fileAt] ?? "") : "";
    const name = (nameAt >= 0 ? cells[nameAt] : "") || file;
    if (name === "") continue;

    const marker = /^amel/i.test(rawMarker) ? SEX_MARKER : canonicalLocus(rawMarker);
    if (!marker) {
      skipped.add(rawMarker);
      continue;
    }

    const key = `${name}␟${file}`;
    let sample = byKey.get(key);
    if (!sample) {
      sample = { key, name, file, label: name, panel: panelAt >= 0 ? (cells[panelAt] ?? "") : "", markers: {} };
      byKey.set(key, sample);
    }

    const alleles = alleleAt.map((index) => (cells[index] ?? "").trim()).filter((allele) => allele !== "");
    const seen = sample.markers[marker];
    if (seen === undefined || seen.length === 0) sample.markers[marker] = alleles;
    else if (alleles.length > 0 && alleles.join("/") !== seen.join("/")) {
      result.problems.push({ kind: "conflict", sample: name, marker });
    }
    if (marker !== SEX_MARKER && !result.markers.includes(marker)) result.markers.push(marker);
  }

  result.samples = [...byKey.values()];
  result.skipped = [...skipped];
  if (result.samples.length === 0) result.problems.push({ kind: "noRows" });

  // Re-injections share a sample name; tell them apart by their file.
  const counts = new Map<string, number>();
  for (const sample of result.samples) counts.set(sample.name, (counts.get(sample.name) ?? 0) + 1);
  for (const sample of result.samples) {
    if ((counts.get(sample.name) ?? 0) > 1 && sample.file) sample.label = `${sample.name} (${sample.file})`;
  }
  return result;
}

export interface ProfileWarning {
  kind:
    /** More than two alleles called: a tri-allelic pattern, a mixture or unfiltered stutter. */
    | "extraAlleles"
    /** "OL" or other text where an allele is expected. */
    | "offLadder";
  marker: string;
  alleles: string[];
}

/** The two cells of the grid for each marker, plus what needs the analyst's eye. */
export function toProfile(sample: ImportedSample): {
  alleles: Record<string, [string, string]>;
  warnings: ProfileWarning[];
} {
  const alleles: Record<string, [string, string]> = {};
  const warnings: ProfileWarning[] = [];
  for (const [marker, called] of Object.entries(sample.markers)) {
    alleles[marker] = [called[0] ?? "", called[1] ?? ""];
    if (called.length > 2) warnings.push({ kind: "extraAlleles", marker, alleles: called });
    const valid = marker === SEX_MARKER ? /^[XY]$/i : /^\d{1,3}([.,]\d)?$/;
    if (called.some((allele) => !valid.test(allele))) warnings.push({ kind: "offLadder", marker, alleles: called });
  }
  return { alleles, warnings };
}

/** The kit whose markers best match the file, to offer a switch when it is not the current one. */
export function bestKit(markers: LocusId[]): Kit | null {
  const found = new Set(markers);
  let best: { kit: Kit; score: number } | null = null;
  for (const kit of KITS) {
    const loci = lociOfKit(kit);
    const shared = loci.filter((locus) => found.has(locus)).length;
    const score = shared / (loci.length + found.size - shared); // Jaccard index
    if (!best || score > best.score) best = { kit, score };
  }
  return best && best.score > 0 ? best.kit : null;
}

const strip = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

const ROLE_TOKENS: Record<ParentSex, Record<SubjectRole, string[]>> = {
  // Paternity: the mother is known, the father alleged.
  male: {
    child: ["HP", "H", "HIJO", "HIJA", "MENOR", "CHILD", "C"],
    alleged: ["PP", "PRESUNTO", "AF", "ALLEGED"],
    known: ["MB", "M", "MADRE", "MOTHER"],
  },
  female: {
    child: ["HP", "H", "HIJO", "HIJA", "MENOR", "CHILD", "C"],
    alleged: ["PM", "PRESUNTA", "AM", "ALLEGED"],
    known: ["PB", "P", "PADRE", "FATHER", "F"],
  },
};

/**
 * Guesses who is who from sample names such as "MB-0042", "HP-0042", "PP-0042".
 * A role is only suggested when exactly one sample matches it; the analyst confirms.
 */
export function suggestRoles(samples: ImportedSample[], allegedSex: ParentSex): Partial<Record<SubjectRole, string>> {
  const suggestion: Partial<Record<SubjectRole, string>> = {};
  for (const role of ["alleged", "known", "child"] as SubjectRole[]) {
    const tokens = ROLE_TOKENS[allegedSex][role];
    const taken = new Set(Object.values(suggestion));
    const matches = samples.filter(
      (sample) => !taken.has(sample.key) && strip(sample.name).split(/[^A-Z0-9]+/).some((token) => tokens.includes(token)),
    );
    if (matches.length === 1) suggestion[role] = matches[0].key;
  }
  return suggestion;
}

export { decodeExport } from "./csv";
