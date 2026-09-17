import fbi2015 from "@/data/populations/fbi2015.json";
import lab from "@/data/populations/lab.json";
import nist1036 from "@/data/populations/nist1036.json";
import ukdna17 from "@/data/populations/ukdna17.json";
import type { LocalizedText, Population } from "@/lib/genetics";

export interface PopulationGroup {
  id: string;
  name: LocalizedText;
}

export const POPULATION_GROUPS: PopulationGroup[] = [
  { id: "lab", name: { es: "Laboratorio", en: "Laboratory" } },
  { id: "custom", name: { es: "Mis poblaciones", en: "My populations" } },
  { id: "fbi2015", name: { es: "FBI 2015 (CODIS ampliado)", en: "FBI 2015 (expanded CODIS)" } },
  { id: "nist1036", name: { es: "NIST 1036 (EE. UU.)", en: "NIST 1036 (U.S.)" } },
  { id: "ukdna17", name: { es: "Reino Unido DNA-17", en: "UK DNA-17" } },
];

export const BUILTIN_POPULATIONS: Population[] = [
  ...(lab as unknown as Population[]),
  ...(fbi2015 as unknown as Population[]),
  ...(nist1036 as unknown as Population[]),
  ...(ukdna17 as unknown as Population[]),
];

export const DEFAULT_POPULATION_ID = "lab-mx-hoja1";

export function findPopulation(id: string, custom: Population[] = []): Population {
  return (
    custom.find((population) => population.id === id) ??
    BUILTIN_POPULATIONS.find((population) => population.id === id) ??
    BUILTIN_POPULATIONS[0]
  );
}
