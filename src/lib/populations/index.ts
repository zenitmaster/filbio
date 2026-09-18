import fbi2015 from "@/data/populations/fbi2015.json";
import mexico from "@/data/populations/mexico.json";
import nist1036 from "@/data/populations/nist1036.json";
import ukdna17 from "@/data/populations/ukdna17.json";
import type { LocalizedText, Population } from "@/lib/genetics";

export interface PopulationGroup {
  id: string;
  name: LocalizedText;
}

/**
 * A laboratory's own tables come first; after them the United States sets, the
 * most complete one leading (NIST 1036 covers every marker of every kit here).
 */
export const POPULATION_GROUPS: PopulationGroup[] = [
  { id: "custom", name: { es: "Mis poblaciones", en: "My populations" } },
  { id: "nist1036", name: { es: "NIST 1036 (EE. UU.)", en: "NIST 1036 (U.S.)" } },
  { id: "fbi2015", name: { es: "FBI 2015 (CODIS ampliado)", en: "FBI 2015 (expanded CODIS)" } },
  { id: "mexico", name: { es: "México", en: "Mexico" } },
  { id: "ukdna17", name: { es: "Reino Unido DNA-17", en: "UK DNA-17" } },
];

/**
 * Within a group, the populations most common in the United States lead, in the
 * order of their share of the census: Caucasian, Hispanic, African American,
 * Asian. Anything not named here keeps the order of its data file.
 */
const LEADING = [
  "nist-cauc",
  "nist-hisp",
  "nist-afam",
  "nist-asian",
  "fbi-caucasian",
  "fbi-sw-hispanic",
  "fbi-se-hispanic",
  "fbi-african-american",
];

function ordered(populations: Population[]): Population[] {
  const rank = (population: Population) => {
    const group = POPULATION_GROUPS.findIndex((candidate) => candidate.id === population.group);
    const lead = LEADING.indexOf(population.id);
    return [group < 0 ? POPULATION_GROUPS.length : group, lead < 0 ? LEADING.length : lead];
  };
  // Array.prototype.sort is stable, so ties keep the order of the data files.
  return [...populations].sort((a, b) => {
    const [groupA, leadA] = rank(a);
    const [groupB, leadB] = rank(b);
    return groupA - groupB || leadA - leadB;
  });
}

export const BUILTIN_POPULATIONS: Population[] = ordered([
  ...(nist1036 as unknown as Population[]),
  ...(fbi2015 as unknown as Population[]),
  ...(mexico as unknown as Population[]),
  ...(ukdna17 as unknown as Population[]),
]);

export const DEFAULT_POPULATION_ID = "nist-cauc";

/** Ids that bundled tables used to have, so saved settings keep pointing at the same data. */
export const RENAMED_POPULATIONS: Record<string, string> = {
  "lab-mx-hoja1": "mx-centro-2013",
};

export function findPopulation(id: string, custom: Population[] = []): Population {
  return (
    custom.find((population) => population.id === id) ??
    BUILTIN_POPULATIONS.find((population) => population.id === id) ??
    BUILTIN_POPULATIONS[0]
  );
}
