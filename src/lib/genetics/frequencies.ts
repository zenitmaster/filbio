import type { Allele } from "./alleles";
import type { LocusId } from "./loci";

export interface LocusFrequencies {
  /** Alleles sampled at this locus (2N). Drives the minimum allele frequency. */
  chromosomes?: number;
  /** Observed allele frequencies as proportions (0-1). Unobserved alleles are absent. */
  freqs: Record<Allele, number>;
}

export interface LocalizedText {
  es: string;
  en: string;
}

export interface Population {
  id: string;
  group: string;
  name: LocalizedText;
  individuals?: number;
  source: { citation: string; url?: string; license?: string };
  notes?: { es: string[]; en: string[] };
  loci: Record<LocusId, LocusFrequencies>;
  /** True for tables the user imported or edited; these live in the browser only. */
  custom?: boolean;
}

/**
 * How rare an allele is allowed to be. A frequency estimated from a finite
 * sample is unreliable near zero, and an allele missing from the sample is not
 * an allele with frequency zero, so every frequency is floored.
 *
 * - "fiveOver2N": 5/(2N), the minimum allele frequency recommended by NRC II
 *   (1996) and the usual forensic default. Falls back to `fixed` when a locus
 *   has no sample size.
 * - "fixed": a constant floor, e.g. 0.001 to reproduce the workbook's 0.1 %.
 */
export interface MinFrequencyPolicy {
  kind: "fiveOver2N" | "fixed";
  fixed: number;
}

export const DEFAULT_MIN_FREQUENCY: MinFrequencyPolicy = { kind: "fiveOver2N", fixed: 0.01 };

export interface FrequencyLookup {
  /** Frequency used in the calculation, after flooring. */
  p: number;
  /** Frequency as tabulated; 0 when the allele was not observed in the sample. */
  tabulated: number;
  observed: boolean;
  /** True when `p` is the minimum frequency rather than the tabulated value. */
  floored: boolean;
  minimum: number;
}

export function minimumFrequency(locus: LocusFrequencies, policy: MinFrequencyPolicy): number {
  if (policy.kind === "fiveOver2N" && locus.chromosomes && locus.chromosomes > 0) {
    return 5 / locus.chromosomes;
  }
  return policy.fixed;
}

export function lookupFrequency(
  locus: LocusFrequencies,
  allele: Allele,
  policy: MinFrequencyPolicy,
): FrequencyLookup {
  const tabulated = locus.freqs[allele] ?? 0;
  const minimum = minimumFrequency(locus, policy);
  const floored = tabulated < minimum;
  return {
    p: floored ? minimum : tabulated,
    tabulated,
    observed: tabulated > 0,
    floored,
    minimum,
  };
}

/** Observed frequencies rescaled to sum to 1, for population-level statistics. */
export function normalizedFrequencies(locus: LocusFrequencies): number[] {
  const values = Object.values(locus.freqs).filter((value) => value > 0);
  const total = values.reduce((sum, value) => sum + value, 0);
  return total > 0 ? values.map((value) => value / total) : [];
}
