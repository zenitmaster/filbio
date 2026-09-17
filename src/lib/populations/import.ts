import {
  canonicalLocus,
  compareAlleles,
  parseAllele,
  type LocusFrequencies,
  type LocusId,
  type Population,
} from "@/lib/genetics";

/**
 * Reads an allele-frequency table laid out the way laboratories keep them in a
 * spreadsheet: alleles down the first column, one marker per column.
 *
 *     Allele   D8S1179   D21S11   ...
 *     8        0.7       0.1
 *     9        1.1       0.1
 *
 * Rows that are not alleles (N, He, PIC, mutation rates...) are skipped.
 */

export type ImportProblem =
  | { kind: "noLoci" }
  | { kind: "unknownLocus"; name: string }
  | { kind: "badAllele"; row: number; value: string }
  | { kind: "badValue"; locus: LocusId; allele: string; value: string }
  | { kind: "annotated"; locus: LocusId; allele: string; value: string; read: number }
  | { kind: "sum"; locus: LocusId; sum: number };

export interface ImportOptions {
  units: "auto" | "percent" | "proportion";
  /** Cells holding exactly this value (in the table's own units) mean "not observed". */
  filler: number | null;
}

export interface ImportResult {
  loci: Record<LocusId, Record<string, number>>;
  units: "percent" | "proportion";
  problems: ImportProblem[];
  lociCount: number;
  alleleCount: number;
  /** A value so common it is probably a placeholder rather than data. */
  suggestedFiller: number | null;
}

function splitLine(line: string, delimiter: string): string[] {
  return line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ""));
}

function detectDelimiter(text: string): string {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  if (first.includes("\t")) return "\t";
  if (first.includes(";")) return ";";
  return ",";
}

/** "28,5", "1.1*" and " 0.285 " are all numbers to a person reading the sheet. */
function parseNumber(raw: string, decimalComma: boolean): { value: number; clean: boolean } | null {
  const text = decimalComma ? raw.replace(",", ".") : raw;
  const match = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?/i.exec(text.trim());
  if (!match) return null;
  return { value: Number(match[0]), clean: match[0].length === text.trim().length };
}

export function parseFrequencyTable(text: string, options: ImportOptions): ImportResult {
  const problems: ImportProblem[] = [];
  const empty: ImportResult = {
    loci: {},
    units: "proportion",
    problems,
    lociCount: 0,
    alleleCount: 0,
    suggestedFiller: null,
  };

  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length < 2) return { ...empty, problems: [{ kind: "noLoci" }] };

  const delimiter = detectDelimiter(text);
  const decimalComma = delimiter !== ",";
  const header = splitLine(lines[0], delimiter);

  const columns: Array<{ index: number; locus: LocusId }> = [];
  header.slice(1).forEach((name, offset) => {
    if (!name) return;
    const locus = canonicalLocus(name);
    if (locus) columns.push({ index: offset + 1, locus });
    else problems.push({ kind: "unknownLocus", name });
  });
  // Say which headers were not understood as well as that none was.
  if (columns.length === 0) return { ...empty, problems: [{ kind: "noLoci" }, ...problems] };

  // First pass: collect the raw numbers, so units and fillers can be judged on all of them.
  const cells: Array<{ locus: LocusId; allele: string; value: number }> = [];
  lines.slice(1).forEach((line, lineIndex) => {
    const row = splitLine(line, delimiter);
    const label = row[0] ?? "";
    const allele = parseAllele(label);
    if (!allele.ok) {
      // Statistics rows start with a word; only flag what looks like a mistyped allele.
      if (/\d/.test(label)) problems.push({ kind: "badAllele", row: lineIndex + 2, value: label });
      return;
    }
    for (const { index, locus } of columns) {
      const raw = row[index] ?? "";
      if (raw === "") continue;
      const parsed = parseNumber(raw, decimalComma);
      if (!parsed || parsed.value < 0) {
        problems.push({ kind: "badValue", locus, allele: allele.allele, value: raw });
        continue;
      }
      // "1.1*": a footnote mark on a real figure. Keep the number, tell the user.
      if (!parsed.clean) {
        problems.push({ kind: "annotated", locus, allele: allele.allele, value: raw, read: parsed.value });
      }
      cells.push({ locus, allele: allele.allele, value: parsed.value });
    }
  });

  const units =
    options.units === "auto"
      ? cells.some((cell) => cell.value > 1)
        ? "percent"
        : "proportion"
      : options.units;

  // A single value filling a large share of the table is a placeholder, not data.
  const counts = new Map<number, number>();
  for (const cell of cells) if (cell.value > 0) counts.set(cell.value, (counts.get(cell.value) ?? 0) + 1);
  const [commonValue, commonCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [0, 0];
  const suggestedFiller = cells.length >= 20 && commonCount / cells.length > 0.4 ? commonValue : null;

  const collected: Record<LocusId, Record<string, number>> = {};
  let alleleCount = 0;
  for (const { locus, allele, value } of cells) {
    if (value === 0) continue;
    if (options.filler !== null && Math.abs(value - options.filler) < 1e-12) continue;
    const proportion = units === "percent" ? value / 100 : value;
    (collected[locus] ??= {})[allele] = Number(((collected[locus][allele] ?? 0) + proportion).toFixed(6));
    alleleCount += 1;
  }

  // Markers keep the order of the sheet's columns, alleles go smallest first.
  const loci: Record<LocusId, Record<string, number>> = {};
  for (const { locus } of columns) {
    const freqs = collected[locus];
    if (!freqs || loci[locus]) continue;
    const sum = Object.values(freqs).reduce((total, value) => total + value, 0);
    if (Math.abs(sum - 1) > 0.02) problems.push({ kind: "sum", locus, sum });
    loci[locus] = Object.fromEntries(Object.entries(freqs).sort(([a], [b]) => compareAlleles(a, b)));
  }

  return { loci, units, problems, lociCount: Object.keys(loci).length, alleleCount, suggestedFiller };
}

export function buildCustomPopulation(input: {
  id?: string;
  name: string;
  citation: string;
  individuals: number;
  loci: Record<LocusId, Record<string, number>>;
}): Population {
  const chromosomes = Math.round(input.individuals * 2);
  const loci: Record<LocusId, LocusFrequencies> = Object.fromEntries(
    Object.entries(input.loci).map(([locus, freqs]) => [locus, { chromosomes, freqs }]),
  );
  return {
    id: input.id ?? `custom-${Date.now().toString(36)}`,
    group: "custom",
    custom: true,
    name: { es: input.name, en: input.name },
    individuals: input.individuals,
    source: { citation: input.citation },
    loci,
  };
}

/** The same layout the importer reads, as proportions, so a round trip is lossless. */
export function populationToCsv(population: Population): string {
  const loci = Object.keys(population.loci);
  const alleles = [...new Set(loci.flatMap((locus) => Object.keys(population.loci[locus].freqs)))].sort(compareAlleles);
  const rows = [["Allele", ...loci].join(",")];
  for (const allele of alleles) {
    rows.push([allele, ...loci.map((locus) => population.loci[locus].freqs[allele] ?? "")].join(","));
  }
  return `${rows.join("\n")}\n`;
}
