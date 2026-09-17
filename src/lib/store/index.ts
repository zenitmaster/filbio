"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  DEFAULT_DECISION,
  DEFAULT_KIT_ID,
  DEFAULT_MIN_FREQUENCY,
  DEFAULT_MUTATION_MODEL,
  type Population,
} from "@/lib/genetics";
import { DEFAULT_POPULATION_ID } from "@/lib/populations";
import { EXAMPLES, type ExampleId } from "./examples";
import {
  emptyEntry,
  type CaseData,
  type LabProfile,
  type Settings,
  type SubjectInfo,
  type SubjectRole,
} from "./types";

export * from "./types";

export function emptyCase(): CaseData {
  return {
    caseId: "",
    requester: "",
    receivedOn: "",
    reportDate: "",
    mode: "trio",
    allegedSex: "male",
    subjects: {
      known: { name: "", sex: "female" },
      child: { name: "", sex: "" },
      alleged: { name: "", sex: "male" },
    },
    alleles: {},
    amelogenin: emptyEntry(),
  };
}

export const DEFAULT_SETTINGS: Settings = {
  locale: "es",
  theme: "system",
  kitId: DEFAULT_KIT_ID,
  populationId: DEFAULT_POPULATION_ID,
  minFrequency: DEFAULT_MIN_FREQUENCY,
  mutationModel: DEFAULT_MUTATION_MODEL,
  mutationOverrides: {},
  decision: DEFAULT_DECISION,
  probabilityDecimals: 6,
  lab: { name: "", contact: "", signerName: "", signerTitle: "", instrument: "" },
};

interface AppState {
  caseData: CaseData;
  settings: Settings;
  customPopulations: Population[];
  /** False until the browser's saved state has been read; avoids a flash of defaults. */
  hydrated: boolean;

  updateCase: (patch: Partial<CaseData>) => void;
  updateSubject: (role: SubjectRole, patch: Partial<SubjectInfo>) => void;
  setAllele: (locus: string, role: SubjectRole, index: 0 | 1, value: string) => void;
  setAmelogenin: (role: SubjectRole, index: 0 | 1, value: string) => void;
  /** Writes a rectangular block of cells in one update (paste from a spreadsheet). */
  setAlleles: (cells: Array<{ locus: string; role: SubjectRole; index: 0 | 1; value: string }>) => void;
  clearCase: () => void;
  loadExample: (id: ExampleId) => void;
  replaceCase: (data: CaseData) => void;

  updateSettings: (patch: Partial<Settings>) => void;
  updateLab: (patch: Partial<LabProfile>) => void;
  resetCalculationSettings: () => void;

  savePopulation: (population: Population) => void;
  removePopulation: (id: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      caseData: emptyCase(),
      settings: DEFAULT_SETTINGS,
      customPopulations: [],
      hydrated: false,

      updateCase: (patch) => set((state) => ({ caseData: { ...state.caseData, ...patch } })),

      updateSubject: (role, patch) =>
        set((state) => ({
          caseData: {
            ...state.caseData,
            subjects: {
              ...state.caseData.subjects,
              [role]: { ...state.caseData.subjects[role], ...patch },
            },
          },
        })),

      setAllele: (locus, role, index, value) =>
        set((state) => {
          const entry = state.caseData.alleles[locus] ?? emptyEntry();
          const pair: [string, string] = [...entry[role]];
          pair[index] = value;
          return {
            caseData: {
              ...state.caseData,
              alleles: { ...state.caseData.alleles, [locus]: { ...entry, [role]: pair } },
            },
          };
        }),

      setAmelogenin: (role, index, value) =>
        set((state) => {
          const pair: [string, string] = [...state.caseData.amelogenin[role]];
          pair[index] = value;
          return {
            caseData: {
              ...state.caseData,
              amelogenin: { ...state.caseData.amelogenin, [role]: pair },
            },
          };
        }),

      setAlleles: (cells) =>
        set((state) => {
          const alleles = { ...state.caseData.alleles };
          for (const { locus, role, index, value } of cells) {
            const entry = alleles[locus] ?? emptyEntry();
            const pair: [string, string] = [...entry[role]];
            pair[index] = value;
            alleles[locus] = { ...entry, [role]: pair };
          }
          return { caseData: { ...state.caseData, alleles } };
        }),

      clearCase: () => set({ caseData: emptyCase() }),

      loadExample: (id) =>
        set((state) => ({
          caseData: structuredClone(EXAMPLES[id]),
          settings: { ...state.settings, kitId: DEFAULT_KIT_ID },
        })),

      replaceCase: (data) => set({ caseData: { ...emptyCase(), ...data } }),

      updateSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),

      updateLab: (patch) =>
        set((state) => ({
          settings: { ...state.settings, lab: { ...state.settings.lab, ...patch } },
        })),

      resetCalculationSettings: () =>
        set((state) => ({
          settings: {
            ...state.settings,
            minFrequency: DEFAULT_MIN_FREQUENCY,
            mutationModel: DEFAULT_MUTATION_MODEL,
            mutationOverrides: {},
            decision: DEFAULT_DECISION,
            probabilityDecimals: DEFAULT_SETTINGS.probabilityDecimals,
          },
        })),

      savePopulation: (population) =>
        set((state) => ({
          customPopulations: [
            ...state.customPopulations.filter((existing) => existing.id !== population.id),
            { ...population, custom: true, group: "custom" },
          ],
        })),

      removePopulation: (id) =>
        set((state) => ({
          customPopulations: state.customPopulations.filter((population) => population.id !== id),
          settings:
            state.settings.populationId === id
              ? { ...state.settings, populationId: DEFAULT_POPULATION_ID }
              : state.settings,
        })),
    }),
    {
      name: "filbio:v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Read on the client after mount, so server and first client render agree.
      skipHydration: true,
      partialize: ({ caseData, settings, customPopulations }) => ({
        caseData,
        settings,
        customPopulations,
      }),
      // Settings gain fields over time; fill whatever an older save lacks.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<AppState>;
        return {
          ...current,
          ...saved,
          caseData: { ...current.caseData, ...saved.caseData },
          settings: {
            ...current.settings,
            ...saved.settings,
            lab: { ...current.settings.lab, ...saved.settings?.lab },
            decision: { ...current.settings.decision, ...saved.settings?.decision },
            mutationModel: { ...current.settings.mutationModel, ...saved.settings?.mutationModel },
            minFrequency: { ...current.settings.minFrequency, ...saved.settings?.minFrequency },
          },
        };
      },
    },
  ),
);
