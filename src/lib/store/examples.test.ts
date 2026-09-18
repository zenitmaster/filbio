/**
 * The demo cases are the first thing a visitor loads. Each must show what its
 * label promises under the defaults the tool opens with, and none may contain
 * an allele the default population has never seen.
 */
import { describe, expect, it } from "vitest";
import {
  computeCase,
  DEFAULT_DECISION,
  DEFAULT_KIT_ID,
  DEFAULT_MIN_FREQUENCY,
  DEFAULT_MUTATION_MODEL,
  kitById,
  KITS,
  lociOfKit,
  type EngineSettings,
} from "@/lib/genetics";
import { DEFAULT_POPULATION_ID, findPopulation } from "@/lib/populations";
import { EXAMPLES, type ExampleId } from "./examples";
import { genotypesOf } from "./parse";

const population = findPopulation(DEFAULT_POPULATION_ID);

function run(id: ExampleId, kitId = DEFAULT_KIT_ID) {
  const example = EXAMPLES[id];
  const loci = lociOfKit(kitById(kitId));
  const { genotypes } = genotypesOf(example, loci);
  const engine: EngineSettings = {
    mode: example.mode,
    allegedSex: example.allegedSex,
    minFrequency: DEFAULT_MIN_FREQUENCY,
    mutationModel: DEFAULT_MUTATION_MODEL,
    mutationOverrides: {},
  };
  return { loci, result: computeCase(loci, genotypes, population.loci, engine, DEFAULT_DECISION) };
}

describe("demo cases under the opening defaults", () => {
  it("trio: every marker computed, nothing inconsistent, an inclusion", () => {
    const { loci, result } = run("trio");
    expect(result.computedCount).toBe(loci.length);
    expect(result.allegedInconsistencies).toEqual([]);
    expect(result.knownInconsistencies).toEqual([]);
    expect(result.verdict).toBe("inclusion");
  });

  it("mutation: the same family with exactly one paternal inconsistency, at FGA, one step away", () => {
    const { result } = run("mutation");
    expect(result.allegedInconsistencies).toEqual(["FGA"]);
    const fga = result.loci.find((locus) => locus.locus === "FGA");
    expect(fga?.mutation?.event).toEqual({ from: "22", to: "21", steps: 1 });
    expect(result.verdict).not.toBe("exclusion");
  });

  it("exclusion: a duo that disagrees at six markers", () => {
    const { result } = run("exclusion");
    expect(result.allegedInconsistencies).toHaveLength(6);
    expect(result.verdict).toBe("exclusion");
  });

  it.each(KITS.map((kit) => kit.id))("the trio is complete and consistent with the %s kit too", (kitId) => {
    const { loci, result } = run("trio", kitId);
    expect(result.computedCount).toBe(loci.length);
    expect(result.allegedInconsistencies).toEqual([]);
  });

  it("uses only alleles the default population has observed", () => {
    for (const example of Object.values(EXAMPLES)) {
      for (const [locus, entry] of Object.entries(example.alleles)) {
        const observed = population.loci[locus]?.freqs ?? {};
        for (const allele of Object.values(entry).flat().filter(Boolean)) {
          expect(observed[allele], `${example.caseId} ${locus} ${allele}`).toBeGreaterThan(0);
        }
      }
    }
  });
});
