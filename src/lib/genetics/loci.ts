/**
 * Locus metadata: repeat-unit length (needed to count mutation steps),
 * sex-specific mutation rates, and the kit panels that set the entry order.
 */

export type LocusId = string;

/** Amelogenin: typed with every kit as a sex and sample-identity check, never part of the index. */
export const SEX_MARKER = "AMEL";

export interface MutationRates {
  /** Probability per meiosis that the father transmits a mutated allele. */
  paternal: number;
  /** Probability per meiosis that the mother transmits a mutated allele. */
  maternal: number;
}

export interface LocusInfo {
  id: LocusId;
  /** Bases per repeat unit. Penta loci are 5, D22S1045 is 3, the rest are 4. */
  repeatLength: number;
}

const tetra = (id: LocusId): LocusInfo => ({ id, repeatLength: 4 });

export const LOCI: Record<LocusId, LocusInfo> = Object.fromEntries(
  [
    tetra("CSF1PO"),
    tetra("D10S1248"),
    tetra("D12S391"),
    tetra("D13S317"),
    tetra("D16S539"),
    tetra("D18S51"),
    tetra("D19S433"),
    tetra("D1S1656"),
    tetra("D21S11"),
    { id: "D22S1045", repeatLength: 3 },
    tetra("D2S1338"),
    tetra("D2S441"),
    tetra("D3S1358"),
    tetra("D5S818"),
    tetra("D6S1043"),
    tetra("D7S820"),
    tetra("D8S1179"),
    tetra("F13A01"),
    tetra("F13B"),
    tetra("FESFPS"),
    tetra("FGA"),
    tetra("LPL"),
    { id: "Penta C", repeatLength: 5 },
    { id: "Penta D", repeatLength: 5 },
    { id: "Penta E", repeatLength: 5 },
    tetra("SE33"),
    tetra("TH01"),
    tetra("TPOX"),
    tetra("vWA"),
  ].map((locus) => [locus.id, locus]),
);

export function repeatLengthOf(locus: LocusId): number {
  return LOCI[locus]?.repeatLength ?? 4;
}

/**
 * Apparent mutation rates observed in paternity testing, AABB Annual Report
 * 2003 as tabulated by NIST STRBase, converted from percent.
 */
export const AABB_MUTATION_RATES: Record<LocusId, MutationRates> = {
  D8S1179: { maternal: 0.0002, paternal: 0.0016 },
  D21S11: { maternal: 0.0011, paternal: 0.0015 },
  D7S820: { maternal: 0.00013, paternal: 0.0012 },
  CSF1PO: { maternal: 0.0003, paternal: 0.0015 },
  D3S1358: { maternal: 0.00015, paternal: 0.0013 },
  TH01: { maternal: 0.00009, paternal: 0.00009 },
  D13S317: { maternal: 0.0004, paternal: 0.0014 },
  D16S539: { maternal: 0.0003, paternal: 0.0011 },
  D2S1338: { maternal: 0.00021, paternal: 0.001 },
  D19S433: { maternal: 0.0005, paternal: 0.00075 },
  vWA: { maternal: 0.0003, paternal: 0.0017 },
  TPOX: { maternal: 0.00004, paternal: 0.00012 },
  D18S51: { maternal: 0.0006, paternal: 0.0022 },
  D5S818: { maternal: 0.00025, paternal: 0.0012 },
  FGA: { maternal: 0.0005, paternal: 0.0032 },
};

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Loci without a published AABB figure (D1S1656, D12S391, SE33, ...) take the
 * average of the tabulated loci, the convention used in the literature when a
 * locus-specific rate is unavailable.
 */
export const DEFAULT_MUTATION_RATES: MutationRates = {
  paternal: mean(Object.values(AABB_MUTATION_RATES).map((rate) => rate.paternal)),
  maternal: mean(Object.values(AABB_MUTATION_RATES).map((rate) => rate.maternal)),
};

export function mutationRatesFor(
  locus: LocusId,
  overrides: Record<LocusId, MutationRates> = {},
): { rates: MutationRates; isDefault: boolean } {
  if (overrides[locus]) return { rates: overrides[locus], isDefault: false };
  if (AABB_MUTATION_RATES[locus]) return { rates: AABB_MUTATION_RATES[locus], isDefault: false };
  return { rates: DEFAULT_MUTATION_RATES, isDefault: true };
}

/** Fluorescent dye channel a locus is read in; analysts read panels in this order. */
export type DyeChannel = "blue" | "green" | "yellow" | "red" | "purple";

export interface KitPanel {
  dye: DyeChannel;
  /** Dye chemistry as printed by the manufacturer, e.g. "6-FAM". */
  label: string;
  loci: LocusId[];
}

export interface Kit {
  id: string;
  name: string;
  panels: KitPanel[];
}

export const KITS: Kit[] = [
  {
    id: "identifiler",
    name: "AmpFℓSTR Identifiler / Identifiler Plus",
    panels: [
      { dye: "blue", label: "6-FAM", loci: ["D8S1179", "D21S11", "D7S820", "CSF1PO"] },
      { dye: "green", label: "VIC", loci: ["D3S1358", "TH01", "D13S317", "D16S539", "D2S1338"] },
      { dye: "yellow", label: "NED", loci: ["D19S433", "vWA", "TPOX", "D18S51"] },
      { dye: "red", label: "PET", loci: ["D5S818", "FGA"] },
    ],
  },
  {
    id: "globalfiler",
    name: "GlobalFiler",
    panels: [
      { dye: "blue", label: "6-FAM", loci: ["D3S1358", "vWA", "D16S539", "CSF1PO", "TPOX"] },
      { dye: "green", label: "VIC", loci: ["D8S1179", "D21S11", "D18S51"] },
      { dye: "yellow", label: "NED", loci: ["D2S441", "D19S433", "TH01", "FGA"] },
      { dye: "red", label: "TAZ", loci: ["D22S1045", "D5S818", "D13S317", "D7S820", "SE33"] },
      { dye: "purple", label: "SID", loci: ["D10S1248", "D1S1656", "D12S391", "D2S1338"] },
    ],
  },
  {
    id: "powerplex16",
    name: "PowerPlex 16 / 16 HS",
    panels: [
      { dye: "blue", label: "Fluorescein", loci: ["D3S1358", "TH01", "D21S11", "D18S51", "Penta E"] },
      { dye: "green", label: "JOE", loci: ["D5S818", "D13S317", "D7S820", "D16S539", "CSF1PO", "Penta D"] },
      { dye: "yellow", label: "TMR", loci: ["vWA", "D8S1179", "TPOX", "FGA"] },
    ],
  },
  {
    id: "powerplex21",
    name: "PowerPlex 21",
    panels: [
      { dye: "blue", label: "Fluorescein", loci: ["D3S1358", "D1S1656", "D6S1043", "D13S317", "Penta E"] },
      { dye: "green", label: "JOE", loci: ["D16S539", "D18S51", "D2S1338", "CSF1PO", "Penta D"] },
      { dye: "yellow", label: "TMR-ET", loci: ["TH01", "vWA", "D21S11", "D7S820", "D5S818", "TPOX"] },
      { dye: "red", label: "CXR-ET", loci: ["D8S1179", "D12S391", "D19S433", "FGA"] },
    ],
  },
  {
    id: "powerplexfusion",
    name: "PowerPlex Fusion",
    panels: [
      { dye: "blue", label: "Fluorescein", loci: ["D3S1358", "D1S1656", "D2S441", "D10S1248", "D13S317", "Penta E"] },
      { dye: "green", label: "JOE", loci: ["D16S539", "D18S51", "D2S1338", "CSF1PO", "Penta D"] },
      { dye: "yellow", label: "TMR-ET", loci: ["TH01", "vWA", "D21S11", "D7S820", "D5S818", "TPOX"] },
      { dye: "red", label: "CXR-ET", loci: ["D8S1179", "D12S391", "D19S433", "FGA", "D22S1045"] },
    ],
  },
  {
    id: "ngmselect",
    name: "NGM SElect (DNA-17)",
    panels: [
      { dye: "blue", label: "6-FAM", loci: ["D10S1248", "vWA", "D16S539", "D2S1338"] },
      { dye: "green", label: "VIC", loci: ["D8S1179", "D21S11", "D18S51"] },
      { dye: "yellow", label: "NED", loci: ["D22S1045", "D19S433", "TH01", "FGA"] },
      { dye: "red", label: "PET", loci: ["D2S441", "D3S1358", "D1S1656", "D12S391", "SE33"] },
    ],
  },
];

export const DEFAULT_KIT_ID = "identifiler";

export function kitById(id: string): Kit {
  return KITS.find((kit) => kit.id === id) ?? KITS[0];
}

export function lociOfKit(kit: Kit): LocusId[] {
  return kit.panels.flatMap((panel) => panel.loci);
}

const ALIAS_KEYS: Record<string, LocusId> = Object.fromEntries(
  Object.keys(LOCI).map((id) => [aliasKey(id), id]),
);
// Spellings seen in the workbook and in common exports.
ALIAS_KEYS[aliasKey("THO1")] = "TH01";
ALIAS_KEYS[aliasKey("HUMTH01")] = "TH01";
ALIAS_KEYS[aliasKey("ACTBP2")] = "SE33";

function aliasKey(name: string): string {
  return name.toUpperCase().replace(/[\s_\-.]/g, "");
}

/** Maps "THO1", "penta_e", "VWA"... to the canonical locus id, or null. */
export function canonicalLocus(name: string): LocusId | null {
  return ALIAS_KEYS[aliasKey(name)] ?? null;
}
