import { describe, expect, it } from "vitest";
import type { Genotype } from "./alleles";
import { powerOfExclusionDuo, powerOfExclusionTrio } from "./exclusion";
import { closedForm } from "./paternity";

// The closed-form powers of exclusion are checked against a brute-force walk
// over every family: draw the parents, transmit alleles, then ask how often a
// random man has no Mendelian way of being the father.
const alleles = ["10", "11", "12", "13", "14"];
const p = [0.05, 0.15, 0.2, 0.25, 0.35];

describe("power of exclusion", () => {
  it("trio formula equals exhaustive enumeration", () => {
    let excluded = 0;
    for (let i = 0; i < p.length; i++) {
      for (let j = 0; j < p.length; j++) {
        const mother: Genotype = [alleles[i], alleles[j]];
        for (const maternal of mother) {
          for (let k = 0; k < p.length; k++) {
            const child: Genotype = [maternal, alleles[k]];
            const familyProbability = p[i] * p[j] * 0.5 * p[k];
            for (let u = 0; u < p.length; u++) {
              for (let v = 0; v < p.length; v++) {
                const man: Genotype = [alleles[u], alleles[v]];
                if (closedForm(child, man, mother) === null) {
                  excluded += familyProbability * p[u] * p[v];
                }
              }
            }
          }
        }
      }
    }
    expect(powerOfExclusionTrio(p)).toBeCloseTo(excluded, 12);
  });

  it("duo formula equals exhaustive enumeration", () => {
    let excluded = 0;
    for (let i = 0; i < p.length; i++) {
      for (let j = 0; j < p.length; j++) {
        const child: Genotype = [alleles[i], alleles[j]];
        for (let u = 0; u < p.length; u++) {
          for (let v = 0; v < p.length; v++) {
            const man: Genotype = [alleles[u], alleles[v]];
            if (closedForm(child, man) === null) excluded += p[i] * p[j] * p[u] * p[v];
          }
        }
      }
    }
    expect(powerOfExclusionDuo(p)).toBeCloseTo(excluded, 12);
  });

  it("is lower without the mother: she is what pins down the paternal allele", () => {
    expect(powerOfExclusionDuo(p)).toBeLessThan(powerOfExclusionTrio(p));
  });
});
