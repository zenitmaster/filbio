import { stepDistance, type Allele, type Genotype } from "./alleles";

/**
 * How an apparent mutation (a locus where parent and child share no allele) is
 * weighed.
 *
 * - "stepwise": STR mutations are replication slippage, overwhelmingly a gain or
 *   loss of one repeat. A mutation is equally likely to add or remove repeats,
 *   and each additional step is `range` times less likely than the one before
 *   (Brenner's rule of thumb is a factor of ten, range = 0.1). A parent with
 *   mutation rate mu therefore transmits an allele s whole steps away with
 *   probability  mu * 1/2 * (1 - range) * range^(s-1),  which sums to mu over
 *   every possible step in both directions.
 * - "aabb": PI = mu / A, where A is the locus's mean power of exclusion. It
 *   ignores how far apart the alleles are.
 */
export interface MutationModel {
  kind: "stepwise" | "aabb";
  range: number;
  /**
   * Probability of a change that is not a whole number of repeats (TH01 9.3 to
   * 10, say). Slippage cannot produce it, so it is far rarer than `rate`.
   */
  fractionalRate: number;
}

export const DEFAULT_MUTATION_MODEL: MutationModel = {
  kind: "stepwise",
  range: 0.1,
  fractionalRate: 1e-6,
};

/** Probability that a parental allele `from` is passed on as `to`. */
export function transitionProbability(
  from: Allele,
  to: Allele,
  rate: number,
  repeatLength: number,
  model: MutationModel,
): number {
  const distance = stepDistance(from, to, repeatLength);
  if (distance.kind === "same") return 1 - rate;
  if (rate === 0) return 0;
  if (distance.kind === "fractional") return Math.min(rate, model.fractionalRate);
  return rate * 0.5 * (1 - model.range) * model.range ** (distance.steps - 1);
}

/** Probability that a parent with this genotype transmits `allele`. */
export function transmissionProbability(
  parent: Genotype,
  allele: Allele,
  rate: number,
  repeatLength: number,
  model: MutationModel,
): number {
  return (
    0.5 * transitionProbability(parent[0], allele, rate, repeatLength, model) +
    0.5 * transitionProbability(parent[1], allele, rate, repeatLength, model)
  );
}

export interface MutationEvent {
  from: Allele;
  to: Allele;
  /** Whole repeat steps, or null when the change is not a whole number of repeats. */
  steps: number | null;
}

/**
 * The smallest change that would turn one of the parent's alleles into one of
 * the `targets` (the alleles the child needs from that parent): the most
 * probable single mutation, reported for the analyst.
 */
export function closestMutation(
  parent: Genotype,
  targets: readonly Allele[],
  repeatLength: number,
): MutationEvent | null {
  let best: MutationEvent | null = null;
  for (const from of parent) {
    for (const to of targets) {
      const distance = stepDistance(from, to, repeatLength);
      if (distance.kind === "same") continue;
      const steps = distance.kind === "integer" ? distance.steps : null;
      const better =
        best === null ||
        (steps !== null && (best.steps === null || steps < best.steps));
      if (better) best = { from, to, steps };
    }
  }
  return best;
}
