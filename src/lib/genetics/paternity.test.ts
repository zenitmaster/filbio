import { describe, expect, it } from "vitest";
import type { Allele, Genotype } from "./alleles";
import type { LocusFrequencies } from "./frequencies";
import { DEFAULT_MUTATION_MODEL, type MutationModel } from "./mutation";
import {
  closedForm,
  computeLocus,
  evaluateFormula,
  obligateAlleles,
  type EngineSettings,
} from "./paternity";

// Four alleles with round frequencies, sampled from so many chromosomes that
// the 5/(2N) floor never interferes with the textbook values.
const P: Record<Allele, number> = { "10": 0.1, "11": 0.2, "12": 0.3, "13": 0.4 };
const FREQS: LocusFrequencies = { chromosomes: 1_000_000, freqs: P };
const a = 0.1;
const b = 0.2;

function settings(overrides: Partial<EngineSettings> = {}): EngineSettings {
  return {
    mode: "trio",
    allegedSex: "male",
    minFrequency: { kind: "fiveOver2N", fixed: 0.01 },
    mutationModel: DEFAULT_MUTATION_MODEL,
    mutationOverrides: {},
    ...overrides,
  };
}

const g = (text: string): Genotype => {
  const [x, y] = text.split("/");
  return [x, y];
};

describe("trio: mother, child, alleged father (textbook table)", () => {
  // Expected values written out from the standard paternity-index table,
  // independently of the implementation. a = p(10) = 0.1, b = p(11) = 0.2.
  it.each([
    ["10/10", "10/10", "10/10", 1 / a, "AA  AA  AA   1/a"],
    ["10/10", "10/10", "10/11", 1 / (2 * a), "AA  AA  AB   1/2a"],
    ["10/11", "10/10", "10/10", 1 / a, "AB  AA  AA   1/a"],
    ["10/11", "10/10", "10/12", 1 / (2 * a), "AB  AA  AC   1/2a"],
    ["10/10", "10/11", "11/11", 1 / b, "AA  AB  BB   1/b"],
    ["10/10", "10/11", "11/12", 1 / (2 * b), "AA  AB  BC   1/2b"],
    ["10/10", "10/11", "10/11", 1 / (2 * b), "AA  AB  AB   1/2b"],
    ["10/11", "10/11", "10/10", 1 / (a + b), "AB  AB  AA   1/(a+b)"],
    ["10/11", "10/11", "10/11", 1 / (a + b), "AB  AB  AB   1/(a+b)"],
    ["10/11", "10/11", "10/12", 1 / (2 * (a + b)), "AB  AB  AC   1/2(a+b)"],
    ["10/11", "10/11", "11/13", 1 / (2 * (a + b)), "AB  AB  BD   1/2(a+b)"],
    ["10/12", "10/11", "11/11", 1 / b, "AC  AB  BB   1/b"],
    ["10/12", "10/11", "11/13", 1 / (2 * b), "AC  AB  BD   1/2b"],
    ["10/12", "10/11", "10/11", 1 / (2 * b), "AC  AB  AB   1/2b"],
    ["11/12", "10/11", "10/13", 1 / (2 * a), "BC  AB  AD   1/2a"],
  ])("M %s  C %s  AF %s", (mother, child, father, expected) => {
    const result = computeLocus(
      "D8S1179",
      { known: g(mother), child: g(child), alleged: g(father) },
      FREQS,
      settings(),
    );
    expect(result.status).toBe("computed");
    expect(result.allegedInconsistent).toBe(false);
    expect(result.pi).toBeCloseTo(expected, 12);
  });

  it("does not depend on the order the alleles were typed in", () => {
    // The workbook only ever compared child allele 2 with father allele 1.
    const typed = computeLocus(
      "D8S1179",
      { known: g("10/12"), child: g("11/10"), alleged: g("13/11") },
      FREQS,
      settings(),
    );
    const sorted = computeLocus(
      "D8S1179",
      { known: g("12/10"), child: g("10/11"), alleged: g("11/13") },
      FREQS,
      settings(),
    );
    expect(typed.pi).toBeCloseTo(1 / (2 * b), 12);
    expect(sorted.pi).toBe(typed.pi);
  });
});

describe("duo: child and alleged father, mother untyped (textbook table)", () => {
  it.each([
    ["10/10", "10/10", 1 / a, "AA  AA   1/a"],
    ["10/10", "10/11", 1 / (2 * a), "AA  AB   1/2a"],
    ["10/11", "10/10", 1 / (2 * a), "AB  AA   1/2a"],
    ["10/11", "11/11", 1 / (2 * b), "AB  BB   1/2b"],
    ["10/11", "10/11", (a + b) / (4 * a * b), "AB  AB   (a+b)/4ab"],
    ["10/11", "10/12", 1 / (4 * a), "AB  AC   1/4a"],
    ["10/11", "11/13", 1 / (4 * b), "AB  BD   1/4b"],
  ])("C %s  AF %s", (child, father, expected) => {
    const result = computeLocus(
      "D8S1179",
      { child: g(child), alleged: g(father) },
      FREQS,
      settings({ mode: "duo" }),
    );
    expect(result.pi).toBeCloseTo(expected, 12);
    expect(result.appliedMode).toBe("duo");
  });

  it("is what the workbook's 1/p overstated by a factor of four", () => {
    // Workbook Duo sheet, D8S1179: child 12/13, father 13/15 -> it reported 1/p.
    const result = computeLocus(
      "D8S1179",
      { child: g("10/11"), alleged: g("11/13") },
      FREQS,
      settings({ mode: "duo" }),
    );
    expect(1 / b / (result.pi as number)).toBeCloseTo(4, 12);
  });
});

describe("enumeration and closed form agree for every genotype combination", () => {
  const alleles = Object.keys(P);
  const genotypes: Genotype[] = [];
  for (let i = 0; i < alleles.length; i++) {
    for (let j = i; j < alleles.length; j++) genotypes.push([alleles[i], alleles[j]]);
  }
  const p = (allele: Allele) => P[allele];

  it("trio: all 1000 combinations", () => {
    let consistent = 0;
    for (const known of genotypes) {
      for (const child of genotypes) {
        for (const alleged of genotypes) {
          const result = computeLocus("D8S1179", { known, child, alleged }, FREQS, settings());
          const formula = closedForm(child, alleged, known);
          if (formula) {
            consistent++;
            expect(result.allegedInconsistent).toBe(false);
            expect(result.pi).toBeCloseTo(evaluateFormula(formula, p), 10);
          } else {
            expect(result.mutation).toBeDefined();
          }
        }
      }
    }
    // Counted independently: 250 of the 1000 trios have a Mendelian explanation.
    expect(consistent).toBe(250);
  });

  it("duo: all 100 combinations", () => {
    let consistent = 0;
    for (const child of genotypes) {
      for (const alleged of genotypes) {
        const result = computeLocus("D8S1179", { child, alleged }, FREQS, settings({ mode: "duo" }));
        const formula = closedForm(child, alleged);
        if (formula) {
          consistent++;
          expect(result.pi).toBeCloseTo(evaluateFormula(formula, p), 10);
        } else {
          expect(result.allegedInconsistent).toBe(true);
        }
      }
    }
    expect(consistent).toBe(58); // pairs that share at least one allele
  });
});

describe("obligate paternal allele", () => {
  it("is what the mother cannot account for", () => {
    expect(obligateAlleles(g("10/11"), g("10/12"))).toEqual(["11"]);
    expect(obligateAlleles(g("10/10"), g("10/12"))).toEqual(["10"]);
  });
  it("is ambiguous when mother and child are the same heterozygote", () => {
    expect(obligateAlleles(g("10/11"), g("11/10"))).toEqual(["10", "11"]);
  });
  it("is empty when the mother does not fit the child", () => {
    expect(obligateAlleles(g("10/11"), g("12/13"))).toEqual([]);
  });
});

describe("apparent mutation, stepwise model", () => {
  const muP = 0.002;
  const muM = 0.0005;
  const overrides = { D8S1179: { paternal: muP, maternal: muM } };
  // One, two and three steps in a given direction: mu * 1/2 * 0.9 * 0.1^(s-1)
  const step = (mu: number, s: number) => mu * 0.5 * 0.9 * 0.1 ** (s - 1);

  it("matches the hand calculation for a trio", () => {
    // M 10/11, C 11/13, AF 12/14: the child's 13 is one step from both of AF's alleles.
    const result = computeLocus(
      "D8S1179",
      { known: g("10/11"), child: g("11/13"), alleged: g("12/14") },
      FREQS,
      settings({ mutationOverrides: overrides }),
    );
    const motherGives11 = 0.5 * (step(muM, 1) + (1 - muM));
    const motherGives13 = 0.5 * (step(muM, 3) + step(muM, 2));
    const fatherGives13 = 0.5 * (step(muP, 1) + step(muP, 1));
    const fatherGives11 = 0.5 * (step(muP, 1) + step(muP, 3));
    const x = motherGives11 * fatherGives13 + motherGives13 * fatherGives11;
    const y = motherGives11 * P["13"] + motherGives13 * P["11"];

    expect(result.allegedInconsistent).toBe(true);
    expect(result.knownInconsistent).toBe(false);
    expect(result.pi).toBeCloseTo(x / y, 14);
    expect(result.mutation).toMatchObject({ model: "stepwise", rate: muP, event: { to: "13", steps: 1 } });
  });

  it("reduces to Brenner's mu/(4p) rule for a single one-step neighbour", () => {
    // AF 12/10 against obligate 13: only the 12 is one step away.
    const result = computeLocus(
      "D8S1179",
      { known: g("11/11"), child: g("11/13"), alleged: g("12/10") },
      FREQS,
      settings({ mutationOverrides: overrides }),
    );
    const brenner = (0.9 * muP) / (4 * P["13"]);
    expect((result.pi as number) / brenner).toBeCloseTo(1, 1); // plus a small 3-step term
  });

  it("uses the maternal rate when the alleged parent is the mother", () => {
    const father = computeLocus(
      "D8S1179",
      { child: g("10/10"), alleged: g("11/11") },
      FREQS,
      settings({ mode: "duo", mutationOverrides: overrides }),
    );
    const mother = computeLocus(
      "D8S1179",
      { child: g("10/10"), alleged: g("11/11") },
      FREQS,
      settings({ mode: "duo", allegedSex: "female", mutationOverrides: overrides }),
    );
    expect(father.mutation?.rate).toBe(muP);
    expect(mother.mutation?.rate).toBe(muM);
    expect((father.pi as number) / (mother.pi as number)).toBeCloseTo(muP / muM, 10);
  });

  it("penalises each extra step tenfold", () => {
    const at = (alleged: string) =>
      computeLocus(
        "D8S1179",
        { child: g("10/10"), alleged: g(alleged) },
        FREQS,
        settings({ mode: "duo", mutationOverrides: overrides }),
      ).pi as number;
    expect(at("11/11") / at("12/12")).toBeCloseTo(10, 10);
    expect(at("12/12") / at("13/13")).toBeCloseTo(10, 10);
  });

  it("finds a paternal inconsistency even when the father shares the maternal allele", () => {
    // M 10/10, C 10/12, AF 10/13: AF has the 10, but the child's 10 is the
    // mother's; the 12 he would have to supply is missing.
    const result = computeLocus(
      "D8S1179",
      { known: g("10/10"), child: g("10/12"), alleged: g("10/13") },
      FREQS,
      settings(),
    );
    expect(result.sharedAlleles).toEqual(["10"]);
    expect(result.obligateAlleles).toEqual(["12"]);
    expect(result.allegedInconsistent).toBe(true);
    expect(result.mutation?.event).toEqual({ from: "13", to: "12", steps: 1 });
  });

  it("flags opposite homozygotes as a possible silent allele", () => {
    const result = computeLocus(
      "D8S1179",
      { child: g("10/10"), alleged: g("12/12") },
      FREQS,
      settings({ mode: "duo" }),
    );
    expect(result.notes).toContainEqual({ kind: "possibleNullAllele" });
  });

  it("treats a change that is not a whole repeat as far rarer than slippage", () => {
    const th01: LocusFrequencies = {
      chromosomes: 1_000_000,
      freqs: { "6": 0.3, "7": 0.3, "9.3": 0.2, "10": 0.2 },
    };
    const result = computeLocus(
      "TH01",
      { known: g("6/7"), child: g("7/10"), alleged: g("9.3/9.3") },
      th01,
      settings(),
    );
    expect(result.notes).toContainEqual({ kind: "fractionalStep" });
    expect(result.mutation?.event).toEqual({ from: "9.3", to: "10", steps: null });
    expect((result.pi as number) / (DEFAULT_MUTATION_MODEL.fractionalRate / 0.2)).toBeCloseTo(1, 2);
  });
});

describe("apparent mutation, AABB mu/A", () => {
  const aabb: MutationModel = { ...DEFAULT_MUTATION_MODEL, kind: "aabb" };

  it("divides the mutation rate by the locus power of exclusion", () => {
    const result = computeLocus(
      "D8S1179",
      { known: g("10/11"), child: g("11/13"), alleged: g("12/12") },
      FREQS,
      settings({ mutationModel: aabb }),
    );
    expect(result.mutation?.model).toBe("aabb");
    const power = result.mutation?.exclusionPower as number;
    expect(power).toBeGreaterThan(0);
    expect(power).toBeLessThan(1);
    expect(result.pi).toBeCloseTo(0.0016 / power, 14);
  });
});

describe("known parent that does not fit the child", () => {
  it("is reported separately and not counted against the alleged father", () => {
    const result = computeLocus(
      "D8S1179",
      { known: g("10/10"), child: g("12/13"), alleged: g("13/13") },
      FREQS,
      settings(),
    );
    expect(result.knownInconsistent).toBe(true);
    expect(result.allegedInconsistent).toBe(false);
    expect(result.pi).toBeGreaterThan(0);
  });
});

describe("allele frequencies", () => {
  const small: LocusFrequencies = { chromosomes: 270, freqs: { "10": 0.5, "11": 0.496, "12": 0.004 } };

  it("floors an unobserved allele at 5/(2N) instead of inventing 0.1 %", () => {
    const result = computeLocus(
      "D8S1179",
      { child: g("13/13"), alleged: g("13/13") },
      small,
      settings({ mode: "duo" }),
    );
    expect(result.pi).toBeCloseTo(1 / (5 / 270), 10); // 54, where the workbook would say 1000
    expect(result.notes).toContainEqual({ kind: "alleleUnobserved", allele: "13" });
  });

  it("floors an observed frequency that is below the minimum", () => {
    const result = computeLocus(
      "D8S1179",
      { child: g("12/12"), alleged: g("12/12") },
      small,
      settings({ mode: "duo" }),
    );
    expect(result.pi).toBeCloseTo(270 / 5, 10);
    expect(result.notes).toContainEqual({ kind: "frequencyFloored", allele: "12" });
  });

  it("can reproduce the workbook's fixed 0.1 % on request", () => {
    const result = computeLocus(
      "D8S1179",
      { child: g("13/13"), alleged: g("13/13") },
      small,
      settings({ mode: "duo", minFrequency: { kind: "fixed", fixed: 0.001 } }),
    );
    expect(result.pi).toBeCloseTo(1000, 8);
  });

  it("stays quiet about a rare allele that cancels out of the index", () => {
    // Trio: the child's 13 is maternal and never enters 1/(2 p10).
    const result = computeLocus(
      "D8S1179",
      { known: g("13/13"), child: g("10/13"), alleged: g("10/11") },
      small,
      settings(),
    );
    expect(result.pi).toBeCloseTo(1 / (2 * 0.5), 12);
    expect(Object.keys(result.frequencies)).toEqual(["10"]);
    expect(result.notes).toEqual([]);
  });

  it("reports a locus the population does not cover", () => {
    const result = computeLocus("SE33", { child: g("10/11"), alleged: g("10/11") }, undefined, settings());
    expect(result.status).toBe("noFrequencies");
    expect(result.pi).toBeUndefined();
  });
});

describe("incomplete data", () => {
  it("waits for both child and alleged parent", () => {
    expect(computeLocus("D8S1179", { child: g("10/11") }, FREQS, settings()).status).toBe("incomplete");
  });

  it("falls back to the duo formula where the mother is untyped, and says so", () => {
    const result = computeLocus(
      "D8S1179",
      { child: g("10/11"), alleged: g("10/12") },
      FREQS,
      settings({ mode: "trio" }),
    );
    expect(result.appliedMode).toBe("duo");
    expect(result.pi).toBeCloseTo(1 / (4 * a), 12);
    expect(result.notes).toContainEqual({ kind: "computedAsDuo" });
  });
});
