import { describe, expect, it } from "vitest";
import { canonicalLocus, KITS, LOCI, lociOfKit, parseAllele } from "@/lib/genetics";
import { BUILTIN_POPULATIONS, DEFAULT_POPULATION_ID, findPopulation, POPULATION_GROUPS } from "./index";

describe("bundled populations", () => {
  it("ships the laboratory table plus the three public reference sets", () => {
    const count = (group: string) => BUILTIN_POPULATIONS.filter((p) => p.group === group).length;
    expect(count("lab")).toBe(1);
    expect(count("nist1036")).toBe(4);
    expect(count("fbi2015")).toBe(11);
    expect(count("ukdna17")).toBe(4);
  });

  it("has unique ids that belong to a known group", () => {
    const ids = BUILTIN_POPULATIONS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const groups = new Set(POPULATION_GROUPS.map((group) => group.id));
    for (const population of BUILTIN_POPULATIONS) expect(groups.has(population.group)).toBe(true);
  });

  describe.each(BUILTIN_POPULATIONS.map((p) => [p.id, p] as const))("%s", (_id, population) => {
    it("uses canonical locus names and valid alleles", () => {
      for (const [locus, data] of Object.entries(population.loci)) {
        expect(canonicalLocus(locus), locus).toBe(locus);
        expect(LOCI[locus], locus).toBeDefined();
        for (const allele of Object.keys(data.freqs)) {
          expect(parseAllele(allele), `${locus} ${allele}`).toEqual({ ok: true, allele });
        }
      }
    });

    it("has frequencies that are proportions summing to one per locus", () => {
      for (const [locus, data] of Object.entries(population.loci)) {
        const values = Object.values(data.freqs);
        for (const value of values) {
          expect(value).toBeGreaterThan(0);
          expect(value).toBeLessThanOrEqual(1);
        }
        const total = values.reduce((sum, value) => sum + value, 0);
        // The laboratory table is rounded to 0.1 %, so allow for that.
        expect(Math.abs(total - 1), `${locus} sums to ${total}`).toBeLessThan(0.003);
      }
    });

    it("records how many chromosomes were sampled, for the 5/(2N) floor", () => {
      for (const data of Object.values(population.loci)) {
        expect(data.chromosomes).toBeGreaterThanOrEqual(100);
      }
      expect(population.source.citation.length).toBeGreaterThan(20);
    });
  });

  it("falls back to the default population for an unknown id", () => {
    expect(findPopulation("nope").id).toBe(DEFAULT_POPULATION_ID);
  });
});

describe("laboratory table (workbook Hoja1)", () => {
  const lab = findPopulation(DEFAULT_POPULATION_ID);

  it("covers the fifteen Identifiler loci, with TH01 spelled correctly", () => {
    expect(Object.keys(lab.loci).sort()).toEqual([...lociOfKit(KITS[0])].sort());
    expect(lab.loci.THO1).toBeUndefined();
  });

  it("drops the 0.1 % fillers", () => {
    for (const data of Object.values(lab.loci)) {
      // The rarest real observation is 1/270 = 0.37 %.
      for (const value of Object.values(data.freqs)) expect(value).toBeGreaterThan(0.003);
    }
  });

  it("carries the D13S317 correction: 4.4 % belongs to allele 14, not 13.2", () => {
    expect(lab.loci.D13S317.freqs["14"]).toBeCloseTo(0.044, 6);
    expect(lab.loci.D13S317.freqs["13.2"]).toBeUndefined();
  });

  it("uses the sample size the data imply (135 people), not the stated 300", () => {
    for (const data of Object.values(lab.loci)) expect(data.chromosomes).toBe(270);
  });
});

describe("kits", () => {
  it("only list loci the engine knows, each once", () => {
    for (const kit of KITS) {
      const loci = lociOfKit(kit);
      expect(new Set(loci).size, kit.id).toBe(loci.length);
      for (const locus of loci) expect(LOCI[locus], `${kit.id} ${locus}`).toBeDefined();
    }
  });
});
