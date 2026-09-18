import { describe, expect, it } from "vitest";
import { kitById, lociOfKit } from "@/lib/genetics";
import { csvField, parseDelimited } from "./csv";
import { buildProfileTable, invalidCalls, parseProfileTable, roleOfHeader } from "./template";

describe("parseDelimited", () => {
  it("keeps a quoted decimal comma together in a comma-separated file", () => {
    expect(parseDelimited('Marcador,Hijo 1,Hijo 2\nTH01,"9,3",7').rows).toEqual([
      ["Marcador", "Hijo 1", "Hijo 2"],
      ["TH01", "9,3", "7"],
    ]);
  });

  it("detects the semicolons Excel writes where the comma is the decimal mark", () => {
    const parsed = parseDelimited("Marcador;Hijo 1;Hijo 2\r\nTH01;9,3;7\r\n");
    expect(parsed.delimiter).toBe(";");
    expect(parsed.rows[1]).toEqual(["TH01", "9,3", "7"]);
  });

  it("reads tabs, a byte-order mark, Excel's sep= hint, doubled quotes and blank lines", () => {
    expect(parseDelimited("﻿a\tb\n\n1\t2\n").rows).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseDelimited("sep=;\r\na;b\r\n1;2").rows).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseDelimited('a,b\n"say ""hi""",2').rows[1]).toEqual(['say "hi"', "2"]);
  });

  it("quotes a field only when it has to", () => {
    expect(csvField("Hijo(a) 1")).toBe("Hijo(a) 1");
    expect(csvField("9,3")).toBe('"9,3"');
  });
});

describe("roleOfHeader", () => {
  it.each([
    ["Madre biológica 1", "known"],
    ["Hijo(a) 2", "child"],
    ["Presunto padre 1", "alleged"], // "padre" alone would be the known parent
    ["Presunta madre 2", "alleged"],
    ["Padre biológico 1", "known"],
    ["Alleged father 1", "alleged"],
    ["Mother 2", "known"],
    ["Child", "child"],
    ["MB1", "known"],
    ["HP 2", "child"],
    ["PP", "alleged"],
  ] as const)("%s is the %s", (header, role) => {
    expect(roleOfHeader(header)).toBe(role);
  });

  it.each(["Marcador", "Notas", "Alelo 1", "ID"])("%s is nobody", (header) => {
    expect(roleOfHeader(header)).toBeNull();
  });
});

describe("parseProfileTable", () => {
  const TRIO = [
    "Marcador,Madre biológica 1,Madre biológica 2,Hijo(a) 1,Hijo(a) 2,Presunto padre 1,Presunto padre 2",
    "D8S1179,13,14,13,15,12,15",
    'TH01,6,"9,3",6,7,7,"9,3"',
    "AMEL,x,x,X,Y,X,Y",
  ].join("\r\n");

  it("reads the template as the grid lays it out", () => {
    const table = parseProfileTable(TRIO);
    expect(table.problems).toEqual([]);
    expect(table.markers).toEqual(["D8S1179", "TH01"]);
    expect(table.profiles.child).toEqual({ D8S1179: ["13", "15"], TH01: ["6", "7"], AMEL: ["X", "Y"] });
    expect(table.profiles.known?.TH01).toEqual(["6", "9,3"]);
    expect(table.profiles.known?.AMEL).toEqual(["X", "X"]); // upper-cased
  });

  it("does not import a person left blank: a duo filled in on a trio template", () => {
    const duo = TRIO.split("\r\n").map((line, i) => (i === 0 ? line : line.replace(/^([^,]+),[^,]*,(?:"[^"]*"|[^,]*),/, "$1,,,"))).join("\r\n");
    const table = parseProfileTable(duo);
    expect(Object.keys(table.profiles).sort()).toEqual(["alleged", "child"]);
  });

  it("accepts a laboratory's own layout: codes, English, reordered, semicolons, extra columns", () => {
    const text = ["Locus;PP1;PP2;HP1;HP2;Notas", "vWA;17;18;16;18;ok", "PENTA_E;12;15;12;15;", "DYS391;10;;;;"].join("\n");
    const table = parseProfileTable(text);
    expect(table.profiles).toEqual({
      alleged: { vWA: ["17", "18"], "Penta E": ["12", "15"] },
      child: { vWA: ["16", "18"], "Penta E": ["12", "15"] },
    });
    expect(table.unknownColumns).toEqual(["Notas"]);
    expect(table.unknownMarkers).toEqual(["DYS391"]);
  });

  it("fills unnumbered columns in order, and treats a dash as empty", () => {
    const table = parseProfileTable("Marker,Child,Child,Alleged father,Alleged father\nFGA,21,-,21,25");
    expect(table.profiles.child?.FGA).toEqual(["21", ""]);
    expect(table.profiles.alleged?.FGA).toEqual(["21", "25"]);
  });

  it("finds the header under a title line", () => {
    const table = parseProfileTable("Caso 0042\n\nMarcador,Hijo 1,Hijo 2\nFGA,21,24");
    expect(table.profiles.child?.FGA).toEqual(["21", "24"]);
  });

  it("says when it is not a profile table, or an empty one", () => {
    expect(parseProfileTable("Allele,D8S1179\n8,0.7").problems).toEqual([{ kind: "noHeader" }]);
    expect(parseProfileTable("Marcador,Hijo 1,Hijo 2\nFGA,,").problems).toEqual([{ kind: "noRows" }]);
  });

  it("points out cells that are not alleles", () => {
    const { profiles } = parseProfileTable("Marcador,Hijo 1,Hijo 2\nFGA,21,OL\nTH01,6,9.3\nAMEL,X,Z");
    expect(invalidCalls(profiles.child ?? {})).toEqual([
      { marker: "FGA", alleles: ["21", "OL"] },
      { marker: "AMEL", alleles: ["X", "Z"] },
    ]);
  });
});

describe("buildProfileTable", () => {
  const loci = lociOfKit(kitById("identifiler"));
  const labels = { known: "Madre biológica", child: "Hijo(a)", alleged: "Presunto padre" };

  it("hands out a blank template for the kit, ready for Excel", () => {
    const csv = buildProfileTable({ loci, roles: ["known", "child", "alleged"], labels, markerLabel: "Marcador" });
    const lines = csv.replace("﻿", "").trimEnd().split("\r\n");
    expect(csv.startsWith("﻿")).toBe(true); // so that Excel reads the accents
    expect(lines[0]).toBe("Marcador,Madre biológica 1,Madre biológica 2,Hijo(a) 1,Hijo(a) 2,Presunto padre 1,Presunto padre 2");
    expect(lines).toHaveLength(loci.length + 2); // header, markers, AMEL
    expect(lines[1]).toBe("D8S1179,,,,,,");
    expect(lines.at(-1)).toBe("AMEL,,,,,,");
  });

  it("leaves the known parent out of a duo template", () => {
    const csv = buildProfileTable({ loci, roles: ["child", "alleged"], labels, markerLabel: "Marcador" });
    expect(csv.split("\r\n")[0]).toBe("﻿Marcador,Hijo(a) 1,Hijo(a) 2,Presunto padre 1,Presunto padre 2");
  });

  it("is read back unchanged, decimal commas included", () => {
    const values = {
      child: { D8S1179: ["13", "15"], TH01: ["6", "9,3"], AMEL: ["X", "Y"] },
      alleged: { D8S1179: ["12", "15"], TH01: ["7", ""], AMEL: ["X", "Y"] },
    } satisfies Record<string, Record<string, [string, string]>>;
    const csv = buildProfileTable({ loci: ["D8S1179", "TH01"], roles: ["child", "alleged"], labels, markerLabel: "Marcador", values });
    expect(parseProfileTable(csv).profiles).toEqual(values);
  });

  it("reads back the English template too", () => {
    const english = { known: "Biological mother", child: "Child", alleged: "Alleged father" };
    const csv = buildProfileTable({ loci: ["FGA"], roles: ["known", "child", "alleged"], labels: english, markerLabel: "Marker", values: { known: { FGA: ["22", "24"] } } });
    expect(parseProfileTable(csv).profiles).toEqual({ known: { FGA: ["22", "24"], AMEL: ["", ""] } });
  });
});
