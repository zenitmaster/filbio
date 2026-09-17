import type { LocusFrequencies } from "./frequencies";
import type { LocusId } from "./loci";
import { computeLocus, type EngineSettings, type LocusGenotypes, type LocusResult } from "./paternity";

export interface DecisionSettings {
  /** Prior probability of parentage. 0.5 gives the conventional W = CPI / (CPI + 1). */
  prior: number;
  /** Posterior probability from which parentage is reported as practically proven. */
  inclusionThreshold: number;
  /** Number of loci inconsistent with the alleged parent that amounts to an exclusion. */
  exclusionInconsistencies: number;
}

export const DEFAULT_DECISION: DecisionSettings = {
  prior: 0.5,
  inclusionThreshold: 0.9999,
  exclusionInconsistencies: 3,
};

export type Verdict =
  /** Nothing to evaluate yet. */
  | "empty"
  /** Too many loci cannot be explained by the alleged parent. */
  | "exclusion"
  /** Not excluded, and the posterior probability reaches the threshold. */
  | "inclusion"
  /** Not excluded, but the evidence is too weak: type more markers. */
  | "inconclusive";

export interface CaseResult {
  loci: LocusResult[];
  computedCount: number;
  /** Combined index: the product of the per-locus indices. */
  cpi: number;
  log10Cpi: number;
  /** Posterior probability of parentage, W. */
  posterior: number;
  /** 1 - W, kept separately because W itself rounds to 1 in floating point. */
  posteriorComplement: number;
  allegedInconsistencies: LocusId[];
  knownInconsistencies: LocusId[];
  verdict: Verdict;
  /** Included even though one or two loci needed a mutation to be explained. */
  mutationAssumed: boolean;
}

export function computeCase(
  loci: LocusId[],
  genotypes: Record<LocusId, LocusGenotypes>,
  frequencies: Record<LocusId, LocusFrequencies>,
  engine: EngineSettings,
  decision: DecisionSettings = DEFAULT_DECISION,
): CaseResult {
  const results = loci.map((locus) =>
    computeLocus(locus, genotypes[locus] ?? {}, frequencies[locus], engine),
  );
  const computed = results.filter((r) => r.status === "computed" && r.pi !== undefined);

  let log10Cpi = 0;
  let zero = false;
  for (const r of computed) {
    if (r.pi === 0) zero = true;
    else log10Cpi += Math.log10(r.pi as number);
  }
  const cpi = computed.length === 0 ? 1 : zero ? 0 : 10 ** log10Cpi;

  // Work with odds so that 1 - W stays accurate when W is indistinguishable from 1.
  const odds = (cpi * decision.prior) / (1 - decision.prior);
  const posteriorComplement = 1 / (1 + odds);
  const posterior = 1 - posteriorComplement;

  const allegedInconsistencies = computed.filter((r) => r.allegedInconsistent).map((r) => r.locus);
  const knownInconsistencies = computed.filter((r) => r.knownInconsistent).map((r) => r.locus);

  let verdict: Verdict;
  if (computed.length === 0) verdict = "empty";
  else if (allegedInconsistencies.length >= decision.exclusionInconsistencies) verdict = "exclusion";
  else if (posterior >= decision.inclusionThreshold) verdict = "inclusion";
  else verdict = "inconclusive";

  return {
    loci: results,
    computedCount: computed.length,
    cpi,
    log10Cpi: zero ? Number.NEGATIVE_INFINITY : log10Cpi,
    posterior,
    posteriorComplement,
    allegedInconsistencies,
    knownInconsistencies,
    verdict,
    mutationAssumed: verdict === "inclusion" && allegedInconsistencies.length > 0,
  };
}

/** Hummel's verbal predicates for the posterior probability W. */
export type HummelPredicate =
  | "practicallyProven"
  | "extremelyLikely"
  | "veryLikely"
  | "likely"
  | "indication"
  | "notInformative";

export function hummelPredicate(posterior: number): HummelPredicate {
  if (posterior >= 0.9973) return "practicallyProven";
  if (posterior >= 0.99) return "extremelyLikely";
  if (posterior >= 0.95) return "veryLikely";
  if (posterior >= 0.9) return "likely";
  if (posterior >= 0.8) return "indication";
  return "notInformative";
}
