import { describe, expect, it } from "vitest";
import {
  alleleLength,
  formatGenotype,
  parseAllele,
  parseSexAllele,
  sharesAllele,
  stepDistance,
} from "./alleles";

describe("parseAllele", () => {
  it.each([
    ["12", "12"],
    [" 12 ", "12"],
    ["12.0", "12"],
    ["012", "12"],
    ["9.3", "9.3"],
    ["9,3", "9.3"], // Spanish decimal comma
    ["32.2", "32.2"],
  ])("reads %j as allele %s", (raw, allele) => {
    expect(parseAllele(raw)).toEqual({ ok: true, allele });
  });

  it.each(["", "  ", "-", null, undefined])("treats %j as empty", (raw) => {
    expect(parseAllele(raw)).toEqual({ ok: false, reason: "empty" });
  });

  it.each(["OL", "<8", ">19", "12.34", "abc", "0", "12/13", "X"])("rejects %j", (raw) => {
    expect(parseAllele(raw)).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("parseSexAllele", () => {
  it("accepts X and Y in either case", () => {
    expect(parseSexAllele("x")).toEqual({ ok: true, allele: "X" });
    expect(parseSexAllele("Y")).toEqual({ ok: true, allele: "Y" });
    expect(parseSexAllele("12")).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("stepDistance", () => {
  it("counts whole repeats", () => {
    expect(stepDistance("12", "13", 4)).toEqual({ kind: "integer", steps: 1 });
    expect(stepDistance("15", "12", 4)).toEqual({ kind: "integer", steps: 3 });
    expect(stepDistance("12", "12", 4)).toEqual({ kind: "same" });
  });

  it("counts whole repeats between microvariants", () => {
    // D21S11 30.2 -> 32.2 is two full repeats; the .2 is carried along.
    expect(stepDistance("30.2", "32.2", 4)).toEqual({ kind: "integer", steps: 2 });
    expect(stepDistance("8.3", "9.3", 4)).toEqual({ kind: "integer", steps: 1 });
  });

  it("flags changes that are not a whole number of repeats", () => {
    // TH01 9.3 is one base short of 10: slippage cannot produce that.
    expect(stepDistance("9.3", "10", 4)).toEqual({ kind: "fractional" });
    expect(stepDistance("13", "13.2", 4)).toEqual({ kind: "fractional" });
  });

  it("uses the locus repeat length", () => {
    expect(alleleLength("9.3", 4)).toBe(39);
    expect(alleleLength("9.4", 5)).toBe(49); // Penta loci: x.4 is a real microvariant
    expect(stepDistance("9.4", "10.4", 5)).toEqual({ kind: "integer", steps: 1 });
    expect(stepDistance("15", "17", 3)).toEqual({ kind: "integer", steps: 2 }); // D22S1045
  });
});

describe("genotype helpers", () => {
  it("compares genotypes regardless of allele order", () => {
    expect(sharesAllele(["12", "13"], ["13", "15"])).toBe(true);
    expect(sharesAllele(["12", "13"], ["15", "12"])).toBe(true);
    expect(sharesAllele(["12", "13"], ["14", "15"])).toBe(false);
  });

  it("prints the smaller allele first", () => {
    expect(formatGenotype(["32.2", "30"])).toBe("30, 32.2");
    expect(formatGenotype(["9.3", "10"])).toBe("9.3, 10");
  });
});
