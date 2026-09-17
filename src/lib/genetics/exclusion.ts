/**
 * Mean power of exclusion of a locus: the chance that a random man, who is not
 * the father, is excluded by that locus alone. Used as the denominator of the
 * AABB mutation formula PI = mu / A. `p` must sum to 1.
 */

/** Mother, child and alleged father typed. */
export function powerOfExclusionTrio(p: number[]): number {
  let first = 0;
  for (const pi of p) first += pi * (1 - pi) ** 2;

  let second = 0;
  for (let i = 0; i < p.length; i++) {
    for (let j = 0; j < p.length; j++) {
      if (i !== j) second += p[i] ** 2 * p[j] ** 2 * (4 - 3 * p[i] - 3 * p[j]);
    }
  }
  return first - 0.5 * second;
}

/** Child and alleged father only; the mother is not typed. */
export function powerOfExclusionDuo(p: number[]): number {
  let homozygous = 0;
  for (const pi of p) homozygous += pi ** 2 * (1 - pi) ** 2;

  let heterozygous = 0;
  for (let i = 0; i < p.length; i++) {
    for (let j = i + 1; j < p.length; j++) {
      heterozygous += 2 * p[i] * p[j] * (1 - p[i] - p[j]) ** 2;
    }
  }
  return homozygous + heterozygous;
}
