import { describe, expect, it } from "vitest";
import { buildCustomPopulation, parseFrequencyTable, populationToCsv } from "./import";

const AUTO = { units: "auto", filler: null } as const;

// The shape of a laboratory sheet: percentages, a filler for unobserved
// alleles, a misspelt marker, a footnoted figure and statistics rows below.
const SHEET = [
  "Allele\tTHO1\tD18S51",
  "6\t33.7\t0.1",
  "7\t35.6\t0.1",
  "9.3\t30.7\t0.1",
  "13\t0.1\t48.9",
  "13.2\t0.1\t1.1*",
  "14\t0.1\t50",
  "N\t300\t300",
  "He\t0.725\t0.876",
  "Mut M\t0.009\t0.06",
].join("\n");

describe("parseFrequencyTable", () => {
  it("reads a sheet pasted from Excel", () => {
    const result = parseFrequencyTable(SHEET, { units: "auto", filler: 0.1 });
    expect(result.units).toBe("percent");
    expect(Object.keys(result.loci)).toEqual(["TH01", "D18S51"]); // THO1 -> TH01
    expect(result.loci.TH01).toEqual({ "6": 0.337, "7": 0.356, "9.3": 0.307 });
    expect(result.loci.D18S51).toEqual({ "13": 0.489, "13.2": 0.011, "14": 0.5 });
  });

  it("keeps a footnoted figure and says so", () => {
    const result = parseFrequencyTable(SHEET, { units: "auto", filler: 0.1 });
    expect(result.problems).toContainEqual({
      kind: "annotated",
      locus: "D18S51",
      allele: "13.2",
      value: "1.1*",
      read: 1.1,
    });
  });

  it("skips statistics rows without complaint", () => {
    const result = parseFrequencyTable(SHEET, { units: "auto", filler: 0.1 });
    expect(result.problems.filter((problem) => problem.kind === "badAllele")).toEqual([]);
  });

  it("notices a placeholder value that fills the table", () => {
    const loci = ["D8S1179", "D21S11", "D7S820", "CSF1PO"];
    const rows = ["Allele\t" + loci.join("\t")];
    for (let allele = 8; allele <= 15; allele++) {
      rows.push([allele, ...loci.map((_, i) => (allele === 10 + i ? 99.3 : 0.1))].join("\t"));
    }
    expect(parseFrequencyTable(rows.join("\n"), AUTO).suggestedFiller).toBe(0.1);
  });

  it("warns when a marker does not sum to one, but tolerates rounding", () => {
    // Left-in fillers, a missing row or a typo all show up as a bad total.
    const off = parseFrequencyTable("Allele\tFGA\n21\t50\n22\t50\n23\t2.5\n24\t2.5", AUTO);
    expect(off.problems).toEqual([{ kind: "sum", locus: "FGA", sum: expect.closeTo(1.05, 6) }]);

    // Three 0.1 % fillers push TH01 to 100.3 %: within what rounding alone produces.
    expect(parseFrequencyTable(SHEET, AUTO).problems.filter((problem) => problem.kind === "sum")).toEqual([]);
  });

  it("reads proportions from a comma-separated file", () => {
    const csv = "Allele,vWA,Penta E\n16,0.25,\n17,0.75,0.4\n18,,0.6\n";
    const result = parseFrequencyTable(csv, AUTO);
    expect(result.units).toBe("proportion");
    expect(result.loci).toEqual({ vWA: { "16": 0.25, "17": 0.75 }, "Penta E": { "17": 0.4, "18": 0.6 } });
    expect(result.problems).toEqual([]);
  });

  it("reads decimal commas when the file is semicolon-separated", () => {
    const result = parseFrequencyTable("Alelo;FGA\n21;45,5\n22;54,5", AUTO);
    expect(result.loci.FGA).toEqual({ "21": 0.455, "22": 0.545 });
  });

  it("reports columns and rows it cannot use", () => {
    const result = parseFrequencyTable("Allele\tFGA\tDYS391\n21\t0.5\t0.2\n2x\t0.1\t\n22\tn/a\t", AUTO);
    expect(result.problems).toContainEqual({ kind: "unknownLocus", name: "DYS391" });
    expect(result.problems).toContainEqual({ kind: "badAllele", row: 3, value: "2x" });
    expect(result.problems).toContainEqual({ kind: "badValue", locus: "FGA", allele: "22", value: "n/a" });
  });

  it("says when nothing in the header is a marker", () => {
    expect(parseFrequencyTable("a\tb\n1\t2", AUTO).problems).toEqual([
      { kind: "noLoci" },
      { kind: "unknownLocus", name: "b" },
    ]);
    expect(parseFrequencyTable("", AUTO).problems).toEqual([{ kind: "noLoci" }]);
  });
});

describe("custom populations", () => {
  it("turns people sampled into chromosomes for the 5/(2N) floor", () => {
    const population = buildCustomPopulation({
      name: "Noreste",
      citation: "Datos propios",
      individuals: 135,
      loci: { FGA: { "21": 0.5, "22": 0.5 } },
    });
    expect(population.loci.FGA.chromosomes).toBe(270);
    expect(population).toMatchObject({ group: "custom", custom: true, name: { es: "Noreste", en: "Noreste" } });
  });

  it("exports a table the importer reads back unchanged", () => {
    const loci = { FGA: { "21": 0.455, "22.2": 0.545 }, TH01: { "9.3": 1 } };
    const population = buildCustomPopulation({ name: "x", citation: "y", individuals: 100, loci });
    expect(parseFrequencyTable(populationToCsv(population), AUTO).loci).toEqual(loci);
  });
});
