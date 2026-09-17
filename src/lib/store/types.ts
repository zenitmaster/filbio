import type {
  CaseMode,
  DecisionSettings,
  Locale,
  LocusId,
  MinFrequencyPolicy,
  MutationModel,
  MutationRates,
  ParentSex,
} from "@/lib/genetics";

/** Known parent (the mother in a standard trio), child, alleged parent. */
export type SubjectRole = "known" | "child" | "alleged";
export const SUBJECT_ROLES: SubjectRole[] = ["known", "child", "alleged"];

/** Alleles exactly as typed; parsing happens at calculation time. */
export type AllelePair = [string, string];
export type LocusEntry = Record<SubjectRole, AllelePair>;

export type Sex = "" | "female" | "male";

export interface SubjectInfo {
  name: string;
  sex: Sex;
}

export interface CaseData {
  caseId: string;
  requester: string;
  /** ISO date, yyyy-mm-dd. */
  receivedOn: string;
  /** Date printed on the report. Empty means today, until the analyst fixes it. */
  reportDate: string;
  mode: CaseMode;
  allegedSex: ParentSex;
  subjects: Record<SubjectRole, SubjectInfo>;
  alleles: Record<LocusId, LocusEntry>;
  amelogenin: LocusEntry;
}

export interface LabProfile {
  name: string;
  contact: string;
  signerName: string;
  signerTitle: string;
  /** Free text appended to the methodology paragraph: instrument, software... */
  instrument: string;
}

export type ThemeChoice = "system" | "light" | "dark";

export interface Settings {
  locale: Locale;
  theme: ThemeChoice;
  kitId: string;
  populationId: string;
  minFrequency: MinFrequencyPolicy;
  mutationModel: MutationModel;
  mutationOverrides: Record<LocusId, MutationRates>;
  decision: DecisionSettings;
  /** Decimals shown for the probability of parentage. */
  probabilityDecimals: number;
  lab: LabProfile;
}

export const EMPTY_PAIR: AllelePair = ["", ""];

export function emptyEntry(): LocusEntry {
  return { known: ["", ""], child: ["", ""], alleged: ["", ""] };
}
