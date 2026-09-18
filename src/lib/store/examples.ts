import type { CaseData, LocusEntry } from "./types";

/**
 * Synthetic cases for trying the tool. The genotypes are invented; they are
 * not, and are not derived from, any real person's profile.
 */

type Row = [known: string, child: string, alleged: string];

function entries(rows: Record<string, Row>): Record<string, LocusEntry> {
  const pair = (text: string): [string, string] => {
    const [a = "", b = ""] = text.split("/");
    return [a, b];
  };
  return Object.fromEntries(
    Object.entries(rows).map(([locus, [known, child, alleged]]) => [
      locus,
      { known: pair(known), child: pair(child), alleged: pair(alleged) },
    ]),
  );
}

const CONSISTENT_TRIO: Record<string, Row> = {
  D8S1179: ["13/14", "13/15", "12/15"],
  D21S11: ["29/30", "30/32.2", "31.2/32.2"],
  D7S820: ["10/11", "10/11", "11/12"],
  CSF1PO: ["11/12", "12/12", "10/12"],
  D3S1358: ["15/16", "15/17", "17/17"],
  TH01: ["6/9.3", "6/7", "7/9.3"],
  D13S317: ["9/11", "11/12", "12/13"],
  D16S539: ["10/12", "12/13", "11/13"],
  D2S1338: ["17/23", "19/23", "19/20"],
  D19S433: ["13/14", "14/15.2", "13/15.2"],
  vWA: ["16/17", "16/18", "17/18"],
  TPOX: ["8/11", "8/8", "8/12"],
  D18S51: ["14/17", "14/15", "15/16"],
  D5S818: ["11/12", "11/11", "11/13"],
  FGA: ["22/24", "21/24", "21/25"],
  // Typed by the PowerPlex kits rather than Identifiler.
  "Penta D": ["9/12", "12/13", "10/13"],
  "Penta E": ["7/12", "12/15", "15/17"],
  // The markers added by the expanded CODIS core (GlobalFiler, PowerPlex Fusion)...
  D2S441: ["10/11", "11/14", "14/15"],
  D22S1045: ["15/16", "16/17", "11/17"],
  SE33: ["17/28.2", "17/19", "19/27.2"],
  D10S1248: ["13/15", "13/14", "14/16"],
  D1S1656: ["12/16", "12/15", "15/17.3"],
  D12S391: ["18/21", "18/22", "19/22"],
  // ...and by PowerPlex 21.
  D6S1043: ["11/12", "12/19", "13/19"],
};

const base = {
  requester: "",
  receivedOn: "",
  reportDate: "",
  allegedSex: "male" as const,
  subjects: {
    known: { name: "", sex: "female" as const },
    child: { name: "", sex: "male" as const },
    alleged: { name: "", sex: "male" as const },
  },
  amelogenin: { known: ["X", "X"], child: ["X", "Y"], alleged: ["X", "Y"] } as LocusEntry,
};

export type ExampleId = "trio" | "mutation" | "exclusion";

export const EXAMPLES: Record<ExampleId, CaseData> = {
  /** Every locus fits: a plain inclusion. */
  trio: { ...base, caseId: "DEMO-1", mode: "trio", alleles: entries(CONSISTENT_TRIO) },

  /** As above, but FGA needs a one-step paternal mutation (22 -> 21). */
  mutation: {
    ...base,
    caseId: "DEMO-2",
    mode: "trio",
    alleles: entries({ ...CONSISTENT_TRIO, FGA: ["22/24", "21/24", "22/25"] }),
  },

  /** Child and alleged father only, and they disagree at six loci. */
  exclusion: {
    ...base,
    caseId: "DEMO-3",
    mode: "duo",
    alleles: entries({
      ...CONSISTENT_TRIO,
      D8S1179: ["", "13/15", "10/12"],
      D21S11: ["", "30/32.2", "28/29"],
      D3S1358: ["", "15/17", "14/16"],
      D13S317: ["", "11/12", "8/9"],
      vWA: ["", "16/18", "14/19"],
      FGA: ["", "21/24", "19/26"],
    }),
  },
};
