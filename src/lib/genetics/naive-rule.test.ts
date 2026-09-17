/**
 * A shortcut that circulates in paternity spreadsheets: line up the allele the
 * child shares with the alleged father and report 1/p for it, whatever the
 * genotypes. That is only right when both are homozygous. These tests pin how
 * far off it is over a whole profile.
 *
 * The genotypes are invented. The expected values were computed independently,
 * from the textbook motherless table implemented in Python.
 */
import { describe, expect, it } from "vitest";
import { findPopulation } from "@/lib/populations";
import type { Genotype } from "./alleles";
import { computeCase } from "./case";
import { formatProbabilityPercent, probabilityToString } from "./format";
import { DEFAULT_MUTATION_MODEL } from "./mutation";
import type { EngineSettings, LocusGenotypes } from "./paternity";

// child allele 1, child allele 2 | father allele 1, father allele 2
const PROFILE: Record<string, [string, string, string, string]> = {
  D8S1179: ["10", "14", "14", "16"],
  D21S11: ["29", "31.2", "31.2", "28"],
  D7S820: ["8", "11", "11", "12"],
  CSF1PO: ["10", "10", "10", "11"],
  D3S1358: ["16", "16", "16", "14"],
  TH01: ["6", "9.3", "9.3", "6"],
  D13S317: ["8", "12", "12", "10"],
  D16S539: ["9", "11", "11", "9"],
  D2S1338: ["17", "23", "23", "23"],
  D19S433: ["14", "15", "15", "15"],
  vWA: ["16", "18", "18", "15"],
  TPOX: ["8", "11", "11", "12"],
  D18S51: ["12", "17", "17", "12"],
  D5S818: ["12", "12", "12", "12"],
  FGA: ["21", "25", "25", "23"],
};

const population = findPopulation("mx-centro-2013");
const loci = Object.keys(PROFILE);
const genotypes: Record<string, LocusGenotypes> = Object.fromEntries(
  Object.entries(PROFILE).map(([locus, [c1, c2, f1, f2]]) => [
    locus,
    { child: [c1, c2] as Genotype, alleged: [f1, f2] as Genotype },
  ]),
);
const engine: EngineSettings = {
  mode: "duo",
  allegedSex: "male",
  minFrequency: { kind: "fiveOver2N", fixed: 0.01 },
  mutationModel: DEFAULT_MUTATION_MODEL,
  mutationOverrides: {},
};

describe("the 1/p shortcut against the motherless formulas", () => {
  const naive = Object.entries(PROFILE).reduce(
    (product, [locus, [, , shared]]) => product / population.loci[locus].freqs[shared],
    1,
  );
  const result = computeCase(loci, genotypes, population.loci, engine);
  const byLocus = Object.fromEntries(result.loci.map((r) => [r.locus, r]));

  it("applies the formula the genotypes call for", () => {
    expect(byLocus.D5S818.formula).toEqual({ kind: "oneOverP", k: 1, allele: "12" }); // AA, AA
    expect(byLocus.CSF1PO.formula).toEqual({ kind: "oneOverP", k: 2, allele: "10" }); // AA, AB
    expect(byLocus.D2S1338.formula).toEqual({ kind: "oneOverP", k: 2, allele: "23" }); // AB, BB
    expect(byLocus.D8S1179.formula).toEqual({ kind: "oneOverP", k: 4, allele: "14" }); // AB, BC
    expect(byLocus.TH01.formula).toEqual({ kind: "sumOverProduct", alleles: ["6", "9.3"] }); // AB, AB
  });

  it("agrees with the independent calculation", () => {
    expect(result.computedCount).toBe(15);
    expect(result.allegedInconsistencies).toEqual([]);
    expect(byLocus.D8S1179.pi).toBeCloseTo(1.141553, 6);
    expect(result.cpi).toBeCloseTo(16786.613455, 5);
  });

  it("shows the shortcut inflating the combined index a million-fold", () => {
    expect(naive).toBeCloseTo(23020978776.61, 1);
    expect(naive / result.cpi).toBeCloseTo(1371389.1, 0);
  });

  it("reports the probability truncated, never as 100 %", () => {
    // The shortcut's index gives W = 99.9999999957 %, which a spreadsheet's
    // ROUND(W, 4) prints as "100%".
    expect(Number(((naive / (naive + 1)) * 100).toFixed(4))).toBe(100);

    const text = probabilityToString(formatProbabilityPercent(result.posteriorComplement, 6));
    expect(text).toBe("99.994043 %"); // 99.9940432272, truncated
  });
});
