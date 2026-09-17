/**
 * STR allele nomenclature (ISFG): "12" is twelve full repeats, "9.3" is nine
 * full repeats plus three extra bases. Alleles are kept as canonical strings so
 * that "9.3" never suffers floating-point comparison, and so "12.0", "12" and
 * " 12 " all name the same allele.
 */

export type Allele = string;
export type Genotype = readonly [Allele, Allele];

export type ParsedAllele =
  | { ok: true; allele: Allele }
  | { ok: false; reason: "empty" | "invalid" };

const ALLELE_PATTERN = /^(\d{1,3})(?:\.(\d))?$/;

/** Accepts "12", "12.0", "9.3" and the Spanish decimal comma "9,3". */
export function parseAllele(raw: string | null | undefined): ParsedAllele {
  const text = (raw ?? "").trim().replace(",", ".");
  if (text === "" || text === "-") return { ok: false, reason: "empty" };

  const match = ALLELE_PATTERN.exec(text);
  if (!match) return { ok: false, reason: "invalid" };

  const repeats = Number.parseInt(match[1], 10);
  const partial = match[2] ? Number.parseInt(match[2], 10) : 0;
  if (repeats === 0 && partial === 0) return { ok: false, reason: "invalid" };

  return { ok: true, allele: partial === 0 ? `${repeats}` : `${repeats}.${partial}` };
}

export type ParsedSexAllele =
  | { ok: true; allele: "X" | "Y" }
  | { ok: false; reason: "empty" | "invalid" };

export function parseSexAllele(raw: string | null | undefined): ParsedSexAllele {
  const text = (raw ?? "").trim().toUpperCase();
  if (text === "" || text === "-") return { ok: false, reason: "empty" };
  if (text === "X" || text === "Y") return { ok: true, allele: text };
  return { ok: false, reason: "invalid" };
}

/** Numeric value used only for ordering and plotting ("9.3" -> 9.3). */
export function alleleValue(allele: Allele): number {
  return Number.parseFloat(allele);
}

export function compareAlleles(a: Allele, b: Allele): number {
  return alleleValue(a) - alleleValue(b);
}

/** Length relative to the locus origin, in bases: "9.3" at a 4-base repeat is 39. */
export function alleleLength(allele: Allele, repeatLength: number): number {
  const [repeats, partial = "0"] = allele.split(".");
  return Number.parseInt(repeats, 10) * repeatLength + Number.parseInt(partial, 10);
}

export type StepDistance =
  | { kind: "same" }
  /** A whole number of repeat units, the change the stepwise model describes. */
  | { kind: "integer"; steps: number }
  /** Not a whole number of repeats (e.g. TH01 9.3 -> 10): not a slippage event. */
  | { kind: "fractional" };

export function stepDistance(from: Allele, to: Allele, repeatLength: number): StepDistance {
  if (from === to) return { kind: "same" };
  const bases = Math.abs(alleleLength(from, repeatLength) - alleleLength(to, repeatLength));
  if (bases === 0) return { kind: "same" };
  return bases % repeatLength === 0
    ? { kind: "integer", steps: bases / repeatLength }
    : { kind: "fractional" };
}

export function isHomozygous(genotype: Genotype): boolean {
  return genotype[0] === genotype[1];
}

export function hasAllele(genotype: Genotype, allele: Allele): boolean {
  return genotype[0] === allele || genotype[1] === allele;
}

export function sharesAllele(a: Genotype, b: Genotype): boolean {
  return hasAllele(b, a[0]) || hasAllele(b, a[1]);
}

/** Genotype with the smaller allele first, so "13/12" and "12/13" display alike. */
export function sortGenotype(genotype: Genotype): Genotype {
  return compareAlleles(genotype[0], genotype[1]) <= 0 ? genotype : [genotype[1], genotype[0]];
}

export function formatGenotype(genotype: Genotype): string {
  const [a, b] = sortGenotype(genotype);
  return `${a}, ${b}`;
}
