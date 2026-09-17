"use client";

import { CaseHeader } from "@/components/CaseHeader";
import { GenotypeGrid } from "@/components/GenotypeGrid";
import { DYE_VAR } from "@/components/LocusTrace";
import { ResultPanel } from "@/components/ResultPanel";
import { Panel } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { useCaseResult } from "@/lib/store/useCaseResult";

export default function CasePage() {
  const t = useT();
  const view = useCaseResult();

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <h1 className="sr-only">{t("nav.case")}</h1>
        <CaseHeader />

        <Panel
          title={t("grid.title")}
          aside={
            // Rows carry the colour of the dye channel they are read in.
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              {view.kit.panels.map((panel) => (
                <li key={panel.label} className="flex items-center gap-1.5">
                  <span className="h-3 w-[3px] rounded-full" style={{ backgroundColor: DYE_VAR[panel.dye] }} />
                  {panel.label}
                </li>
              ))}
            </ul>
          }
        >
          <p className="border-b border-line px-4 py-2.5 text-sm leading-snug text-muted">{t("grid.help")}</p>
          <GenotypeGrid view={view} />
        </Panel>
      </div>

      <div className="lg:sticky lg:top-6">
        <ResultPanel view={view} />
      </div>
    </div>
  );
}
