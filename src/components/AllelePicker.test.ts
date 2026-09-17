import { describe, expect, it } from "vitest";
import type { LocusFrequencies } from "@/lib/genetics";
import { optionsFor, SEX_MARKER } from "./AllelePicker";

const TH01: LocusFrequencies = {
  chromosomes: 700,
  freqs: { "10": 0.0029, "6": 0.3843, "9.3": 0.1856, "7": 0.2729, "9": 0.1 },
};

describe("optionsFor", () => {
  it("lists the population's alleles in allele order, then offers another", () => {
    const options = optionsFor("TH01", TH01, "");
    expect(options.map((o) => (o.kind === "other" ? "other" : o.value))).toEqual(["6", "7", "9", "9.3", "10", "other"]);
    expect(options[0]).toEqual({ kind: "allele", value: "6", frequency: 0.3843 });
  });

  it("narrows to what has been typed", () => {
    expect(optionsFor("TH01", TH01, "9").map((o) => o.kind === "allele" && o.value)).toEqual(["9", "9.3"]);
  });

  it("reads the Spanish decimal comma", () => {
    expect(optionsFor("TH01", TH01, "9,3")).toEqual([{ kind: "allele", value: "9.3", frequency: 0.1856 }]);
  });

  it("offers a valid allele the table lacks as a custom value", () => {
    expect(optionsFor("TH01", TH01, "8")).toEqual([{ kind: "custom", value: "8" }]);
    // "1" is a prefix of 10 and also an allele in its own right.
    expect(optionsFor("TH01", TH01, "1")).toEqual([
      { kind: "allele", value: "10", frequency: 0.0029 },
      { kind: "custom", value: "1" },
    ]);
  });

  it("offers nothing for text that is not an allele", () => {
    expect(optionsFor("TH01", TH01, "OL")).toEqual([]);
  });

  it("still takes a custom allele when the population lacks the marker", () => {
    expect(optionsFor("SE33", undefined, "")).toEqual([{ kind: "other" }]);
    expect(optionsFor("SE33", undefined, "28.2")).toEqual([{ kind: "custom", value: "28.2" }]);
  });

  it("offers X and Y for amelogenin, whatever the case typed", () => {
    expect(optionsFor(SEX_MARKER, undefined, "")).toEqual([
      { kind: "allele", value: "X" },
      { kind: "allele", value: "Y" },
    ]);
    expect(optionsFor(SEX_MARKER, undefined, "y")).toEqual([{ kind: "allele", value: "Y" }]);
  });
});
