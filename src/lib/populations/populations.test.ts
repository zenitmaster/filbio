import { describe, expect, it } from "vitest";
import { canonicalLocus, KITS, LOCI, lociOfKit, normalizedFrequencies, parseAllele } from "@/lib/genetics";
import {
  BUILTIN_POPULATIONS,
  DEFAULT_POPULATION_ID,
  findPopulation,
  POPULATION_GROUPS,
  RENAMED_POPULATIONS,
} from "./index";

describe("bundled populations", () => {
  it("ships two Mexican tables plus the three public reference sets", () => {
    const count = (group: string) => BUILTIN_POPULATIONS.filter((p) => p.group === group).length;
    expect(count("mexico")).toBe(2);
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
        // Published tables are rounded (central Mexico to 0.1 %), and the Yucatán
        // table's D8S1179 column adds up to 0.9967 as printed.
        expect(Math.abs(total - 1), `${locus} sums to ${total}`).toBeLessThan(0.005);
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

describe("central Mexico (Macías-Vega et al., 2013)", () => {
  const centro = findPopulation(DEFAULT_POPULATION_ID);

  it("is the default and covers the fifteen Identifiler markers", () => {
    expect(centro.id).toBe("mx-centro-2013");
    expect(Object.keys(centro.loci).sort()).toEqual([...lociOfKit(KITS[0])].sort());
  });

  it("still answers to the id it was first bundled under", () => {
    expect(RENAMED_POPULATIONS["lab-mx-hoja1"]).toBe(centro.id);
  });

  it("holds observations only: the rarest is one chromosome in 270", () => {
    for (const data of Object.values(centro.loci)) {
      for (const value of Object.values(data.freqs)) expect(value).toBeGreaterThan(0.003);
    }
  });

  it("carries the D13S317 correction: the printed 4.4 % belongs to allele 14, not 13.2", () => {
    expect(centro.loci.D13S317.freqs["14"]).toBeCloseTo(0.044, 6);
    expect(centro.loci.D13S317.freqs["13.2"]).toBeUndefined();
  });

  it("uses the sample size the printed frequencies imply (270 chromosomes), not the stated 300 people", () => {
    expect(centro.individuals).toBe(300);
    for (const data of Object.values(centro.loci)) expect(data.chromosomes).toBe(270);
  });
});

describe("Yucatán Peninsula (DIMYGEN, 2016)", () => {
  const yucatan = findPopulation("mx-yucatan-2016");

  it("covers the fifteen PowerPlex 16 markers, 350 people each", () => {
    const powerplex16 = KITS.find((kit) => kit.id === "powerplex16");
    expect(Object.keys(yucatan.loci).sort()).toEqual([...lociOfKit(powerplex16!)].sort());
    for (const data of Object.values(yucatan.loci)) expect(data.chromosomes).toBe(700);
  });

  it("lacks the two Identifiler markers that PowerPlex 16 does not type", () => {
    expect(yucatan.loci.D2S1338).toBeUndefined();
    expect(yucatan.loci.D19S433).toBeUndefined();
  });

  it("reproduces the PIC the source prints for every marker", () => {
    // Printed beside the frequencies in the source. A value transcribed into the
    // wrong column or row would not survive this.
    const published: Record<string, number> = {
      D3S1358: 0.65, vWA: 0.72, "Penta D": 0.8, CSF1PO: 0.67, D16S539: 0.73, D7S820: 0.75,
      D13S317: 0.8, D5S818: 0.65, "Penta E": 0.9, D18S51: 0.86, D21S11: 0.81, D8S1179: 0.76,
      TPOX: 0.64, FGA: 0.86, TH01: 0.69,
    };
    for (const [locus, expected] of Object.entries(published)) {
      const p = normalizedFrequencies(yucatan.loci[locus]);
      const s2 = p.reduce((sum, x) => sum + x * x, 0);
      const s4 = p.reduce((sum, x) => sum + x ** 4, 0);
      const pic = 1 - s2 - (s2 * s2 - s4);
      expect(Number(pic.toFixed(2)), locus).toBe(expected);
    }
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
