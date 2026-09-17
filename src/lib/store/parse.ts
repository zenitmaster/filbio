import { parseAllele, type Genotype, type LocusGenotypes, type LocusId } from "@/lib/genetics";
import type { AllelePair, CaseData, LocusEntry, SubjectRole } from "./types";

export interface ParsedPair {
  genotype?: Genotype;
  /** Only one allele was typed; a single peak is read as a homozygote. */
  assumedHomozygous: boolean;
  /** Per cell: the text is not an allele ("OL", "<8", "12/13"...). */
  invalid: [boolean, boolean];
}

export function parsePair(pair: AllelePair): ParsedPair {
  const [first, second] = [parseAllele(pair[0]), parseAllele(pair[1])];
  const invalid: [boolean, boolean] = [
    !first.ok && first.reason === "invalid",
    !second.ok && second.reason === "invalid",
  ];
  if (invalid[0] || invalid[1]) return { assumedHomozygous: false, invalid };

  if (first.ok && second.ok) {
    return { genotype: [first.allele, second.allele], assumedHomozygous: false, invalid };
  }
  const only = first.ok ? first : second.ok ? second : null;
  return only
    ? { genotype: [only.allele, only.allele], assumedHomozygous: true, invalid }
    : { assumedHomozygous: false, invalid };
}

export type ParsedEntry = Record<SubjectRole, ParsedPair>;

export function parseEntry(entry: LocusEntry | undefined): ParsedEntry {
  return {
    known: parsePair(entry?.known ?? ["", ""]),
    child: parsePair(entry?.child ?? ["", ""]),
    alleged: parsePair(entry?.alleged ?? ["", ""]),
  };
}

export function genotypesOf(
  data: CaseData,
  loci: LocusId[],
): { genotypes: Record<LocusId, LocusGenotypes>; parsed: Record<LocusId, ParsedEntry> } {
  const genotypes: Record<LocusId, LocusGenotypes> = {};
  const parsed: Record<LocusId, ParsedEntry> = {};
  for (const locus of loci) {
    const entry = parseEntry(data.alleles[locus]);
    parsed[locus] = entry;
    genotypes[locus] = {
      known: data.mode === "trio" ? entry.known.genotype : undefined,
      child: entry.child.genotype,
      alleged: entry.alleged.genotype,
    };
  }
  return { genotypes, parsed };
}

export type AmelogeninWarning =
  /** The typed X/Y does not match the sex recorded for that person. */
  | { kind: "sexMismatch"; role: SubjectRole }
  /** An alleged father typed X,X, or an alleged mother typed X,Y. */
  | { kind: "roleMismatch"; role: SubjectRole };

function typedSex(pair: AllelePair): "female" | "male" | null {
  const alleles = pair.map((value) => value.trim().toUpperCase());
  if (alleles.every((value) => value === "X")) return "female";
  if (alleles.includes("X") && alleles.includes("Y")) return "male";
  return null;
}

/** Amelogenin is a sample-identity check, not part of the index. */
export function amelogeninWarnings(data: CaseData): AmelogeninWarning[] {
  const warnings: AmelogeninWarning[] = [];
  const expectedByRole: Record<SubjectRole, "female" | "male" | null> = {
    alleged: data.allegedSex,
    known: data.allegedSex === "male" ? "female" : "male",
    child: null,
  };
  const roles: SubjectRole[] = data.mode === "trio" ? ["known", "child", "alleged"] : ["child", "alleged"];

  for (const role of roles) {
    const typed = typedSex(data.amelogenin[role]);
    if (!typed) continue;
    const expected = expectedByRole[role];
    if (expected && typed !== expected) warnings.push({ kind: "roleMismatch", role });
    else if (data.subjects[role].sex && typed !== data.subjects[role].sex) {
      warnings.push({ kind: "sexMismatch", role });
    }
  }
  return warnings;
}
