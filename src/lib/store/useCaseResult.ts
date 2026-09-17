"use client";

import { useMemo } from "react";
import { computeCase, kitById, lociOfKit, type EngineSettings } from "@/lib/genetics";
import { findPopulation } from "@/lib/populations";
import { useAppStore } from "./index";
import { amelogeninWarnings, genotypesOf } from "./parse";

/** Everything derived from the case as typed: parsed alleles, indices, verdict. */
export function useCaseResult() {
  const caseData = useAppStore((state) => state.caseData);
  const settings = useAppStore((state) => state.settings);
  const customPopulations = useAppStore((state) => state.customPopulations);

  return useMemo(() => {
    const kit = kitById(settings.kitId);
    const loci = lociOfKit(kit);
    const population = findPopulation(settings.populationId, customPopulations);
    const { genotypes, parsed } = genotypesOf(caseData, loci);

    const engine: EngineSettings = {
      mode: caseData.mode,
      allegedSex: caseData.allegedSex,
      minFrequency: settings.minFrequency,
      mutationModel: settings.mutationModel,
      mutationOverrides: settings.mutationOverrides,
    };
    const result = computeCase(loci, genotypes, population.loci, engine, settings.decision);

    return {
      kit,
      loci,
      population,
      parsed,
      result,
      byLocus: Object.fromEntries(result.loci.map((locus) => [locus.locus, locus])),
      amelogenin: amelogeninWarnings(caseData),
    };
  }, [caseData, settings, customPopulations]);
}

export type CaseView = ReturnType<typeof useCaseResult>;
