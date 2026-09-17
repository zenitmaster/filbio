import { describe, expect, it } from "vitest";
import type { Genotype } from "./alleles";
import { computeCase, DEFAULT_DECISION, hummelPredicate } from "./case";
import { formatIndex, formatProbabilityPercent, probabilityToString, toScientific } from "./format";
import type { LocusFrequencies } from "./frequencies";
import { DEFAULT_MUTATION_MODEL } from "./mutation";
import type { EngineSettings, LocusGenotypes } from "./paternity";

const FREQS: LocusFrequencies = {
  chromosomes: 1_000_000,
  freqs: { "10": 0.1, "11": 0.2, "12": 0.3, "13": 0.4 },
};
const engine: EngineSettings = {
  mode: "duo",
  allegedSex: "male",
  minFrequency: { kind: "fiveOver2N", fixed: 0.01 },
  mutationModel: DEFAULT_MUTATION_MODEL,
  mutationOverrides: {},
};
const LOCI = ["D8S1179", "D21S11", "D7S820", "CSF1PO", "D3S1358", "TH01"];
const everywhere = (genotypes: LocusGenotypes) => ({
  genotypes: Object.fromEntries(LOCI.map((locus) => [locus, genotypes])),
  frequencies: Object.fromEntries(LOCI.map((locus) => [locus, FREQS])),
});
const g = (x: string, y: string): Genotype => [x, y];

describe("computeCase", () => {
  it("multiplies the per-locus indices and converts to a posterior", () => {
    const { genotypes, frequencies } = everywhere({ child: g("10", "10"), alleged: g("10", "10") });
    const result = computeCase(LOCI, genotypes, frequencies, engine);
    expect(result.cpi).toBeCloseTo(10 ** 6, 3); // six loci at 1/0.1
    expect(result.posterior).toBeCloseTo(1e6 / (1e6 + 1), 12);
    expect(result.verdict).toBe("inclusion");
    expect(result.mutationAssumed).toBe(false);
  });

  it("honours a prior other than 0.5", () => {
    const { genotypes, frequencies } = everywhere({ child: g("10", "11"), alleged: g("10", "12") });
    const prior = 0.1;
    const result = computeCase(LOCI, genotypes, frequencies, engine, { ...DEFAULT_DECISION, prior });
    const cpi = 2.5 ** 6;
    expect(result.posterior).toBeCloseTo((cpi * prior) / (cpi * prior + 1 - prior), 12);
  });

  it("is inconclusive when nothing excludes but the evidence is thin", () => {
    // The workbook called anything above W = 0.9 % "compatible".
    const { genotypes, frequencies } = everywhere({ child: g("12", "13"), alleged: g("13", "11") });
    const result = computeCase(LOCI, genotypes, frequencies, engine);
    expect(result.allegedInconsistencies).toEqual([]);
    expect(result.posterior).toBeLessThan(0.9999);
    expect(result.verdict).toBe("inconclusive");
  });

  it("excludes at three inconsistent loci, not before", () => {
    const match: LocusGenotypes = { child: g("10", "10"), alleged: g("10", "10") };
    const mismatch: LocusGenotypes = { child: g("10", "10"), alleged: g("12", "13") };
    const frequencies = Object.fromEntries(LOCI.map((locus) => [locus, FREQS]));
    const withMismatches = (n: number) =>
      computeCase(
        LOCI,
        Object.fromEntries(LOCI.map((locus, i) => [locus, i < n ? mismatch : match])),
        frequencies,
        engine,
      );

    expect(withMismatches(2).verdict).not.toBe("exclusion");
    expect(withMismatches(2).allegedInconsistencies).toHaveLength(2);
    expect(withMismatches(3).verdict).toBe("exclusion");
  });

  it("notes when an inclusion rests on an assumed mutation", () => {
    const strong: LocusFrequencies = { chromosomes: 1_000_000, freqs: { "10": 0.001, "11": 0.999 } };
    const loci = ["D8S1179", "D21S11", "D7S820", "CSF1PO"];
    const genotypes = {
      D8S1179: { child: g("10", "10"), alleged: g("10", "10") },
      D21S11: { child: g("10", "10"), alleged: g("10", "10") },
      D7S820: { child: g("10", "10"), alleged: g("10", "10") },
      CSF1PO: { child: g("10", "10"), alleged: g("11", "11") }, // one step away
    };
    const frequencies = Object.fromEntries(loci.map((locus) => [locus, strong]));
    const result = computeCase(loci, genotypes, frequencies, engine);
    expect(result.verdict).toBe("inclusion");
    expect(result.mutationAssumed).toBe(true);
  });

  it("reports nothing until a locus can be computed", () => {
    const result = computeCase(LOCI, {}, {}, engine);
    expect(result.verdict).toBe("empty");
    expect(result.computedCount).toBe(0);
  });

  it("ignores loci the population does not cover", () => {
    const { genotypes } = everywhere({ child: g("10", "10"), alleged: g("10", "10") });
    const result = computeCase(LOCI, genotypes, { D8S1179: FREQS }, engine);
    expect(result.computedCount).toBe(1);
    expect(result.cpi).toBeCloseTo(10, 10);
  });
});

describe("probability formatting", () => {
  it("never reports 100 %", () => {
    // The workbook's duo example: CPI 7.9e12 rounded to exactly 100.
    const complement = 1 / (7875797024646 + 1);
    expect(probabilityToString(formatProbabilityPercent(complement, 6))).toBe("> 99.999999 %");
    expect(probabilityToString(formatProbabilityPercent(0, 4))).toBe("> 99.9999 %");
  });

  it("truncates instead of rounding up", () => {
    // 99.998765 would round to 99.9988; a report must not overstate.
    expect(formatProbabilityPercent(1 - 0.99998765, 4)).toEqual({ value: "99.9987", bound: "" });
    expect(formatProbabilityPercent(1 - 0.91014708, 4).value).toBe("91.0147");
  });

  it("gives a lower bound once every displayed digit is a nine", () => {
    // 99.99999 % at four decimals: "99.9999" is true but hides that it is higher.
    expect(formatProbabilityPercent(1 - 0.9999999, 4)).toEqual({ value: "99.9999", bound: ">" });
    expect(formatProbabilityPercent(1 - 0.99999, 2)).toEqual({ value: "99.99", bound: ">" });
  });

  it("is not thrown off by binary representation", () => {
    expect(formatProbabilityPercent(1 - 0.9999, 6).value).toBe("99.990000");
  });

  it("bounds a vanishing probability from above", () => {
    expect(probabilityToString(formatProbabilityPercent(1 - 1e-12, 6))).toBe("< 0.000001 %");
  });
});

describe("index formatting", () => {
  it("keeps four significant figures", () => {
    expect(formatIndex(3.50877193)).toBe("3.509");
    expect(formatIndex(0.005614035)).toBe("0.005614");
    expect(formatIndex(1000)).toBe("1000");
    expect(formatIndex(54321.9)).toBe("54,320");
  });

  it("switches to powers of ten at the extremes", () => {
    expect(formatIndex(7875797024646)).toBe("7.88 × 10¹²");
    expect(formatIndex(1.7e-8)).toBe("1.70 × 10⁻⁸");
  });

  it("carries a rounded-up mantissa into the exponent", () => {
    expect(toScientific(9.9996e5, 3)).toEqual({ mantissa: "1.00", exponent: 6 });
  });
});

describe("Hummel's verbal predicates", () => {
  it.each([
    [0.99999, "practicallyProven"],
    [0.9973, "practicallyProven"],
    [0.995, "extremelyLikely"],
    [0.97, "veryLikely"],
    [0.92, "likely"],
    [0.85, "indication"],
    [0.5, "notInformative"],
  ] as const)("W = %f is %s", (posterior, predicate) => {
    expect(hummelPredicate(posterior)).toBe(predicate);
  });
});
