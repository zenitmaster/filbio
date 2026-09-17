/**
 * Paternity (or maternity) index per locus.
 *
 *   PI = X / Y
 *   X  = P(child's genotype | the alleged parent is the biological parent)
 *   Y  = P(child's genotype | a random person from the population is)
 *
 * Both probabilities are obtained by summing over the two ways the child's
 * alleles can be split between the parents. Writing S(x) for the probability
 * that a source hands down allele x:
 *
 *   trio   X = sum S_known(x) * S_alleged(y)     Y = sum S_known(x) * p(y)
 *   duo    X = sum S_alleged(x) * p(y)           Y = sum p(x) * p(y)
 *
 * With no mutation S is 1, 1/2 or 0 and this reduces exactly to the textbook
 * tables (1/p, 1/2p, 1/(a+b), (a+b)/4ab ...). The closed form is derived
 * separately in `closedForm` so the two can be checked against each other.
 *
 * Where the alleged parent and child cannot be reconciled without a mutation,
 * the same sums are evaluated with the mutation model switched on.
 */

import {
  compareAlleles,
  hasAllele,
  isHomozygous,
  sharesAllele,
  type Allele,
  type Genotype,
} from "./alleles";
import { powerOfExclusionDuo, powerOfExclusionTrio } from "./exclusion";
import {
  lookupFrequency,
  normalizedFrequencies,
  type FrequencyLookup,
  type LocusFrequencies,
  type MinFrequencyPolicy,
} from "./frequencies";
import { mutationRatesFor, repeatLengthOf, type LocusId, type MutationRates } from "./loci";
import {
  closestMutation,
  transmissionProbability,
  type MutationEvent,
  type MutationModel,
} from "./mutation";

export type CaseMode = "trio" | "duo";
/** Sex of the alleged parent. The known parent, when typed, is the other sex. */
export type ParentSex = "male" | "female";

export interface LocusGenotypes {
  child?: Genotype;
  alleged?: Genotype;
  /** The undisputed parent; only used in a trio. */
  known?: Genotype;
}

export interface EngineSettings {
  mode: CaseMode;
  allegedSex: ParentSex;
  minFrequency: MinFrequencyPolicy;
  mutationModel: MutationModel;
  mutationOverrides: Record<LocusId, MutationRates>;
}

/** Textbook closed form of the index, for display and cross-checking. */
export type Formula =
  /** 1 / (k * p_a) */
  | { kind: "oneOverP"; k: 1 | 2 | 4; allele: Allele }
  /** 1 / (k * (p_a + p_b)) */
  | { kind: "oneOverSum"; k: 1 | 2; alleles: [Allele, Allele] }
  /** (p_a + p_b) / (4 * p_a * p_b) */
  | { kind: "sumOverProduct"; alleles: [Allele, Allele] };

export type LocusNote =
  /** An allele that drives the index was never seen in the population sample. */
  | { kind: "alleleUnobserved"; allele: Allele }
  /** A tabulated frequency was below the minimum and was raised to it. */
  | { kind: "frequencyFloored"; allele: Allele }
  /** Both apparent homozygotes for different alleles: consider a silent allele. */
  | { kind: "possibleNullAllele" }
  /** The nearest explanation is not a whole number of repeats. */
  | { kind: "fractionalStep" }
  /** No locus-specific mutation rate; the average of the tabulated loci was used. */
  | { kind: "defaultMutationRate" }
  /** Trio case, but the known parent is untyped here, so the duo formula applies. */
  | { kind: "computedAsDuo" };

export interface MutationDetail {
  model: MutationModel["kind"];
  rate: number;
  rateIsDefault: boolean;
  event: MutationEvent | null;
  /** Mean power of exclusion, when the AABB formula was used. */
  exclusionPower?: number;
}

export interface LocusResult {
  locus: LocusId;
  status: "computed" | "incomplete" | "noFrequencies";
  /** Formula actually applied, which is "duo" when the known parent is untyped. */
  appliedMode: CaseMode;
  pi?: number;
  formula?: Formula;
  /** Child alleles that must have come from the alleged parent. */
  obligateAlleles: Allele[];
  /** Child alleles also carried by the alleged parent. */
  sharedAlleles: Allele[];
  allegedInconsistent: boolean;
  knownInconsistent: boolean;
  mutation?: MutationDetail;
  /** Frequencies that influence the index (those that cancel out are omitted). */
  frequencies: Record<Allele, FrequencyLookup>;
  notes: LocusNote[];
}

/** The ways a genotype's two alleles can be assigned to two distinct sources. */
function orderings(genotype: Genotype): Array<[Allele, Allele]> {
  const [a, b] = genotype;
  return a === b
    ? [[a, a]]
    : [
        [a, b],
        [b, a],
      ];
}

type Source = (allele: Allele) => number;

function likelihood(child: Genotype, first: Source, second: Source): number {
  let total = 0;
  for (const [x, y] of orderings(child)) total += first(x) * second(y);
  return total;
}

function unique(alleles: Allele[]): Allele[] {
  return [...new Set(alleles)].sort(compareAlleles);
}

/**
 * Child alleles the alleged parent must have contributed, assuming no mutation.
 * In a trio these are what remains once the known parent's contribution is
 * taken out; when known parent and child are the same heterozygote either
 * allele may be the one, and both are returned.
 */
export function obligateAlleles(child: Genotype, known?: Genotype): Allele[] {
  if (!known) return unique([...child]);
  const candidates: Allele[] = [];
  for (const [fromKnown, fromAlleged] of orderings(child)) {
    if (hasAllele(known, fromKnown)) candidates.push(fromAlleged);
  }
  return unique(candidates);
}

/** Closed-form index for a locus that needs no mutation, or null if it needs one. */
export function closedForm(child: Genotype, alleged: Genotype, known?: Genotype): Formula | null {
  const copies = (allele: Allele) => (alleged[0] === allele ? 1 : 0) + (alleged[1] === allele ? 1 : 0);

  if (known) {
    const candidates = obligateAlleles(child, known);
    if (candidates.length === 0) return null;
    if (candidates.length === 1) {
      const n = copies(candidates[0]);
      return n === 0 ? null : { kind: "oneOverP", k: n === 2 ? 1 : 2, allele: candidates[0] };
    }
    const n = copies(candidates[0]) + copies(candidates[1]);
    return n === 0
      ? null
      : { kind: "oneOverSum", k: n === 2 ? 1 : 2, alleles: [candidates[0], candidates[1]] };
  }

  if (isHomozygous(child)) {
    const n = copies(child[0]);
    return n === 0 ? null : { kind: "oneOverP", k: n === 2 ? 1 : 2, allele: child[0] };
  }

  const [a, b] = child;
  const na = copies(a);
  const nb = copies(b);
  if (na === 0 && nb === 0) return null;
  if (na === 1 && nb === 1) return { kind: "sumOverProduct", alleles: unique([a, b]) as [Allele, Allele] };
  const shared = na > 0 ? a : b;
  return { kind: "oneOverP", k: Math.max(na, nb) === 2 ? 2 : 4, allele: shared };
}

export function evaluateFormula(formula: Formula, p: (allele: Allele) => number): number {
  switch (formula.kind) {
    case "oneOverP":
      return 1 / (formula.k * p(formula.allele));
    case "oneOverSum":
      return 1 / (formula.k * (p(formula.alleles[0]) + p(formula.alleles[1])));
    case "sumOverProduct": {
      const [a, b] = formula.alleles;
      return (p(a) + p(b)) / (4 * p(a) * p(b));
    }
  }
}

export function computeLocus(
  locus: LocusId,
  genotypes: LocusGenotypes,
  frequencies: LocusFrequencies | undefined,
  settings: EngineSettings,
): LocusResult {
  const { child, alleged } = genotypes;
  const known = settings.mode === "trio" ? genotypes.known : undefined;

  const result: LocusResult = {
    locus,
    status: "incomplete",
    appliedMode: known ? "trio" : "duo",
    obligateAlleles: [],
    sharedAlleles: [],
    allegedInconsistent: false,
    knownInconsistent: false,
    frequencies: {},
    notes: [],
  };
  if (!child || !alleged) return result;

  result.sharedAlleles = unique(child.filter((allele) => hasAllele(alleged, allele)));
  result.knownInconsistent = known ? !sharesAllele(child, known) : false;
  result.obligateAlleles = result.knownInconsistent ? [] : obligateAlleles(child, known);

  if (!frequencies || Object.keys(frequencies.freqs).length === 0) {
    result.status = "noFrequencies";
    return result;
  }
  result.status = "computed";
  if (settings.mode === "trio" && !known) result.notes.push({ kind: "computedAsDuo" });

  const repeatLength = repeatLengthOf(locus);
  const { rates, isDefault } = mutationRatesFor(locus, settings.mutationOverrides);
  const allegedRate = settings.allegedSex === "male" ? rates.paternal : rates.maternal;
  const knownRate = settings.allegedSex === "male" ? rates.maternal : rates.paternal;

  const lookups: Record<Allele, FrequencyLookup> = {};
  const lookup = (allele: Allele) =>
    (lookups[allele] ??= lookupFrequency(frequencies, allele, settings.minFrequency));

  const from = (parent: Genotype, rate: number): Source => (allele) =>
    transmissionProbability(parent, allele, rate, repeatLength, settings.mutationModel);

  /** Likelihood ratio for the given allele-frequency source and mutation rates. */
  const ratio = (p: Source, rateAlleged: number, rateKnown: number): number => {
    const x = known
      ? likelihood(child, from(known, rateKnown), from(alleged, rateAlleged))
      : likelihood(child, from(alleged, rateAlleged), p);
    const y = known ? likelihood(child, from(known, rateKnown), p) : likelihood(child, p, p);
    return y > 0 ? x / y : 0;
  };

  const tabulated: Source = (allele) => lookup(allele).p;
  let rateAlleged = 0;
  let rateKnown = 0;
  let usesFrequencies = true;

  const mendelian = ratio(tabulated, 0, 0);
  if (mendelian > 0) {
    result.pi = mendelian;
    result.formula = closedForm(child, alleged, known) ?? undefined;
  } else {
    // No Mendelian explanation. If the known parent fits the child the
    // discrepancy lies with the alleged parent; otherwise it only counts
    // against the alleged parent when the two share no allele at all.
    result.allegedInconsistent = result.knownInconsistent ? result.sharedAlleles.length === 0 : true;

    const targets = result.obligateAlleles.length > 0 ? result.obligateAlleles : unique([...child]);
    const event = result.allegedInconsistent ? closestMutation(alleged, targets, repeatLength) : null;

    if (settings.mutationModel.kind === "aabb" && result.allegedInconsistent) {
      const observed = normalizedFrequencies(frequencies);
      const power = known ? powerOfExclusionTrio(observed) : powerOfExclusionDuo(observed);
      result.pi = allegedRate / power;
      result.mutation = { model: "aabb", rate: allegedRate, rateIsDefault: isDefault, event, exclusionPower: power };
      usesFrequencies = false;
    } else {
      rateAlleged = allegedRate;
      rateKnown = knownRate;
      result.pi = ratio(tabulated, rateAlleged, rateKnown);
      result.mutation = { model: "stepwise", rate: allegedRate, rateIsDefault: isDefault, event };
    }

    if (isDefault) result.notes.push({ kind: "defaultMutationRate" });
    if (event && event.steps === null) result.notes.push({ kind: "fractionalStep" });
    if (result.allegedInconsistent && isHomozygous(child) && isHomozygous(alleged)) {
      result.notes.push({ kind: "possibleNullAllele" });
    }
  }

  // Report only the frequencies that move the index. Some cancel between X and
  // Y (the child's maternal allele in a trio), and under the mutation model
  // others enter only through a double-mutation path worth parts per million;
  // flagging those as rare or unobserved would be noise. A frequency counts
  // when a 1 % change in it shifts the index by more than 0.01 %.
  if (usesFrequencies && result.pi > 0) {
    const base = result.pi;
    for (const allele of Object.keys(lookups).sort(compareAlleles)) {
      const nudged: Source = (a) => lookup(a).p * (a === allele ? 1.01 : 1);
      const moved = Math.abs(ratio(nudged, rateAlleged, rateKnown) / base - 1) > 1e-4;
      if (!moved) continue;
      const found = lookups[allele];
      result.frequencies[allele] = found;
      if (!found.observed) result.notes.push({ kind: "alleleUnobserved", allele });
      else if (found.floored) result.notes.push({ kind: "frequencyFloored", allele });
    }
  }
  return result;
}
