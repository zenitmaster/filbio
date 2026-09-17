import { describe, expect, it } from "vitest";
import { bestKit, decodeExport, parseGeneMapper, suggestRoles, toProfile } from "./genemapper";

// Invented samples in the layout GeneMapper ID-X writes: tab-delimited, one row
// per sample and marker, with whatever extra columns the table settings carry.
const HEADER = ["Sample File", "Sample Name", "Panel", "Marker", "Dye", "Allele 1", "Allele 2", "Allele 3", "Size 1", "Size 2", "Height 1", "Height 2"].join("\t");
const row = (file: string, name: string, marker: string, dye: string, ...alleles: string[]) =>
  [file, name, "Identifiler_Plus_Panels_v1X", marker, dye, alleles[0] ?? "", alleles[1] ?? "", alleles[2] ?? "", "123.4", "127.6", "1510", "1490"].join("\t");

const EXPORT = [
  HEADER,
  row("A01_MB-0042.hid", "MB-0042", "D8S1179", "B", "13", "14"),
  row("A01_MB-0042.hid", "MB-0042", "TH01", "G", "6", "9.3"),
  row("A01_MB-0042.hid", "MB-0042", "AMEL", "R", "X"),
  row("B01_HP-0042.hid", "HP-0042", "D8S1179", "B", "13", "15"),
  row("B01_HP-0042.hid", "HP-0042", "TH01", "G", "7"), // homozygote: Allele 2 left empty
  row("B01_HP-0042.hid", "HP-0042", "AMEL", "R", "X", "Y"),
  row("C01_PP-0042.hid", "PP-0042", "D8S1179", "B", "12", "15"),
  row("C01_PP-0042.hid", "PP-0042", "TH01", "G", "7", "OL"),
  row("C01_PP-0042.hid", "PP-0042", "TPOX", "Y", "8", "10", "11"),
  row("C01_PP-0042.hid", "PP-0042", "AMEL", "R", "X", "Y"),
  row("C01_PP-0042.hid", "PP-0042", "DYS391", "G", "10"),
  "",
].join("\r\n");

describe("parseGeneMapper", () => {
  const parsed = parseGeneMapper(EXPORT);

  it("groups the rows by sample", () => {
    expect(parsed.problems).toEqual([]);
    expect(parsed.samples.map((sample) => sample.label)).toEqual(["MB-0042", "HP-0042", "PP-0042"]);
    expect(parsed.samples[0].panel).toBe("Identifiler_Plus_Panels_v1X");
  });

  it("reads the alleles, amelogenin included", () => {
    expect(parsed.samples[1].markers).toEqual({ D8S1179: ["13", "15"], TH01: ["7"], AMEL: ["X", "Y"] });
  });

  it("lists autosomal markers and sets aside the ones it does not use", () => {
    expect(parsed.markers).toEqual(["D8S1179", "TH01", "TPOX"]);
    expect(parsed.skipped).toEqual(["DYS391"]);
  });

  it("accepts the marker spellings other exports use", () => {
    const text = ["Sample Name,Marker,Allele 1,Allele 2", "S1,THO1,6,7", "S1,PENTA_E,12,14", "S1,vWA,16,18", "S1,Amelogenin,X,X"].join("\n");
    expect(parseGeneMapper(text).samples[0].markers).toEqual({
      TH01: ["6", "7"],
      "Penta E": ["12", "14"],
      vWA: ["16", "18"],
      AMEL: ["X", "X"],
    });
  });

  it("finds the header below a preamble and without a sample-name column", () => {
    const text = ["GeneMapper export", "", "Sample File\tMarker\tAllele 1\tAllele 2", "run1.fsa\tFGA\t21\t24"].join("\n");
    const result = parseGeneMapper(text);
    expect(result.samples.map((sample) => sample.label)).toEqual(["run1.fsa"]);
    expect(result.samples[0].markers.FGA).toEqual(["21", "24"]);
  });

  it("tells re-injections of one sample apart by their file", () => {
    const text = [HEADER, row("A01.hid", "HP-7", "FGA", "R", "21", "24"), row("A02.hid", "HP-7", "FGA", "R", "21", "24")].join("\n");
    expect(parseGeneMapper(text).samples.map((sample) => sample.label)).toEqual(["HP-7 (A01.hid)", "HP-7 (A02.hid)"]);
  });

  it("reports two different calls for the same sample and marker", () => {
    const text = [HEADER, row("A01.hid", "HP-7", "FGA", "R", "21", "24"), row("A01.hid", "HP-7", "FGA", "R", "21", "25")].join("\n");
    expect(parseGeneMapper(text).problems).toEqual([{ kind: "conflict", sample: "HP-7", marker: "FGA" }]);
  });

  it("says when the text is not a genotype table", () => {
    expect(parseGeneMapper("just some text\nwith lines").problems).toEqual([{ kind: "noHeader" }]);
    expect(parseGeneMapper(HEADER).problems).toEqual([{ kind: "noRows" }]);
  });
});

describe("toProfile", () => {
  const father = parseGeneMapper(EXPORT).samples[2];
  const { alleles, warnings } = toProfile(father);

  it("fills the two cells of each marker, leaving a homozygote's second cell empty", () => {
    expect(alleles.D8S1179).toEqual(["12", "15"]);
    expect(toProfile(parseGeneMapper(EXPORT).samples[1]).alleles.TH01).toEqual(["7", ""]);
  });

  it("flags what the analyst has to resolve", () => {
    expect(warnings).toContainEqual({ kind: "offLadder", marker: "TH01", alleles: ["7", "OL"] });
    expect(warnings).toContainEqual({ kind: "extraAlleles", marker: "TPOX", alleles: ["8", "10", "11"] });
    expect(alleles.TPOX).toEqual(["8", "10"]);
  });
});

describe("suggestRoles", () => {
  const { samples } = parseGeneMapper(EXPORT);

  it("recognises the laboratory's sample codes", () => {
    const roles = suggestRoles(samples, "male");
    expect(roles).toEqual({ alleged: samples[2].key, known: samples[0].key, child: samples[1].key });
  });

  it("stays silent when a code is ambiguous", () => {
    const twoChildren = parseGeneMapper([HEADER, row("a.hid", "HP1-9", "FGA", "R", "21"), row("b.hid", "HP-9", "FGA", "R", "22"), row("c.hid", "H-9", "FGA", "R", "22")].join("\n"));
    expect(suggestRoles(twoChildren.samples, "male").child).toBeUndefined();
  });
});

describe("bestKit", () => {
  it("recognises the kit from the markers typed", () => {
    expect(bestKit(["D8S1179", "D21S11", "D7S820", "CSF1PO", "D3S1358", "TH01", "D13S317", "D16S539", "D2S1338", "D19S433", "vWA", "TPOX", "D18S51", "D5S818", "FGA"])?.id).toBe("identifiler");
    expect(bestKit(["D3S1358", "TH01", "D21S11", "D18S51", "Penta E", "D5S818", "D13S317", "D7S820", "D16S539", "CSF1PO", "Penta D", "vWA", "D8S1179", "TPOX", "FGA"])?.id).toBe("powerplex16");
    expect(bestKit(["D3S1358", "vWA", "D16S539", "CSF1PO", "TPOX", "D8S1179", "D21S11", "D18S51", "D2S441", "D19S433", "TH01", "FGA", "D22S1045", "D5S818", "D13S317", "D7S820", "SE33", "D10S1248", "D1S1656", "D12S391", "D2S1338"])?.id).toBe("globalfiler");
    expect(bestKit([])).toBeNull();
  });
});

describe("decodeExport", () => {
  it("falls back to the Windows code page GeneMapper writes", () => {
    const utf8 = new TextEncoder().encode("Muñoz").buffer as ArrayBuffer;
    const windows1252 = new Uint8Array([0x4d, 0x75, 0xf1, 0x6f, 0x7a]).buffer as ArrayBuffer;
    expect(decodeExport(utf8)).toBe("Muñoz");
    expect(decodeExport(windows1252)).toBe("Muñoz");
  });
});
