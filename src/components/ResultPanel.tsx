"use client";

import Link from "next/link";
import {
  formatFrequency,
  formatGrouped,
  formatProbabilityPercent,
  hummelPredicate,
  minimumFrequency,
  toScientific,
  type Verdict,
} from "@/lib/genetics";
import { plural, roleLabel, useLocale, useT, type MessageKey } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import type { CaseView } from "@/lib/store/useCaseResult";
import { buttonClass, cn, Notice } from "./ui";

const VERDICT_STYLE: Record<Verdict, string> = {
  empty: "border-line bg-sunken text-muted",
  inclusion: "border-included/30 bg-included-soft text-included",
  exclusion: "border-excluded/30 bg-excluded-soft text-excluded",
  inconclusive: "border-attention/30 bg-attention-soft text-attention",
};

export function ResultPanel({ view }: { view: CaseView }) {
  const t = useT();
  const locale = useLocale();
  const caseData = useAppStore((state) => state.caseData);
  const settings = useAppStore((state) => state.settings);

  const { result, population, loci, amelogenin } = view;
  const sex = caseData.allegedSex;
  const alleged = roleLabel(t, "alleged", sex).toLowerCase();
  const known = roleLabel(t, "known", sex);
  const threshold = trimPercent(settings.decision.inclusionThreshold * 100);
  const hasResult = result.verdict !== "empty";

  const verdictTitle: Record<Verdict, string> = {
    empty: t("verdict.empty.title"),
    inclusion: t(`verdict.inclusion.title.${sex}`),
    exclusion: t(`verdict.exclusion.title.${sex}`),
    inconclusive: t("verdict.inconclusive.title"),
  };
  const verdictBody: Record<Verdict, string> = {
    empty: t("verdict.empty.body", { alleged }),
    inclusion: t("verdict.inclusion.body", { threshold }),
    exclusion: t("verdict.exclusion.body", {
      n: result.allegedInconsistencies.length,
      alleged,
      threshold: settings.decision.exclusionInconsistencies,
    }),
    inconclusive: t("verdict.inconclusive.body", { threshold }),
  };

  const probability = formatProbabilityPercent(result.posteriorComplement, settings.probabilityDecimals);
  const scientific = toScientific(result.cpi, 3);
  const useScientific = result.cpi >= 1e7 || (result.cpi > 0 && result.cpi < 1e-3);

  const missing = result.loci.filter((locus) => locus.status === "noFrequencies").map((locus) => locus.locus);
  const sampleLocus = Object.values(population.loci)[0];
  const minimum = sampleLocus ? minimumFrequency(sampleLocus, settings.minFrequency) : settings.minFrequency.fixed;

  return (
    <aside aria-label={t("result.title")} className="flex flex-col gap-4">
      {/* Announced politely so a screen-reader user hears the verdict change as they type. */}
      <div aria-live="polite" className={cn("rounded-lg border px-4 py-3.5", VERDICT_STYLE[result.verdict])}>
        <p className="font-serif text-xl leading-tight font-semibold">{verdictTitle[result.verdict]}</p>
        <p className="mt-1 text-sm leading-snug opacity-90">{verdictBody[result.verdict]}</p>
      </div>

      {hasResult && (
        <div className="rounded-lg border border-line bg-surface">
          <dl className="divide-y divide-line">
            <div className="px-4 py-3">
              <dt className="text-sm text-muted">{t(`result.posterior.${sex}`)}</dt>
              <dd className="mt-0.5 font-serif text-[1.7rem] leading-tight font-semibold text-ink">
                {probability.bound && <span className="mr-1 font-normal">{probability.bound}</span>}
                {probability.value}
                <span className="ml-1 text-lg font-normal text-muted">%</span>
              </dd>
              <dd className="mt-0.5 text-xs text-muted">
                {t("result.prior", { prior: settings.decision.prior })}
              </dd>
            </div>

            <div className="px-4 py-3">
              <dt className="text-sm text-muted">{t(`result.cpi.${sex}`)}</dt>
              <dd className="mt-0.5 font-serif text-[1.7rem] leading-tight font-semibold text-ink">
                {useScientific ? (
                  <>
                    {scientific.mantissa} × 10<sup className="text-[0.6em]">{scientific.exponent}</sup>
                  </>
                ) : (
                  formatGrouped(result.cpi, locale)
                )}
              </dd>
              {useScientific && result.cpi < 1e21 && result.cpi >= 1 && (
                <dd className="mt-0.5 text-xs break-all text-muted">{formatGrouped(result.cpi, locale)}</dd>
              )}
            </div>

            <Fact label={t("result.computed")} value={t("result.computed.value", { n: result.computedCount, total: loci.length })} />
            <Fact
              label={t("result.inconsistencies", { alleged })}
              value={String(result.allegedInconsistencies.length)}
              detail={result.allegedInconsistencies.join(", ")}
              emphasis={result.allegedInconsistencies.length > 0}
            />
            {/* A verbal predicate under an inconclusive or excluding verdict would contradict it. */}
            {result.verdict === "inclusion" && (
              <Fact
                label={t("result.hummel")}
                value={t(`hummel.${hummelPredicate(result.posterior)}` as MessageKey)}
              />
            )}
            <Fact label={t("result.population")} value={population.name[locale]} />
            <Fact
              label={t("result.minimum")}
              value={
                settings.minFrequency.kind === "fiveOver2N"
                  ? `${t("result.minimum.fiveOver2N")} = ${formatFrequency(minimum, locale)}`
                  : t("result.minimum.fixed", { value: formatFrequency(minimum, locale) })
              }
            />
          </dl>
        </div>
      )}

      {hasResult && (
        <div className="flex flex-col gap-2">
          {result.knownInconsistencies.length > 0 && (
            <Notice tone="invalid">
              {t("warning.knownInconsistent", { known, loci: result.knownInconsistencies.join(", ") })}
            </Notice>
          )}
          {result.mutationAssumed && (
            <Notice>
              {plural(t, "warning.mutationAssumed", result.allegedInconsistencies.length, {
                loci: result.allegedInconsistencies.join(", "),
              })}
            </Notice>
          )}
          {result.verdict === "inconclusive" && result.allegedInconsistencies.length > 0 && (
            <Notice>
              {plural(t, "warning.inconsistenciesBelowThreshold", result.allegedInconsistencies.length, {
                loci: result.allegedInconsistencies.join(", "),
              })}
            </Notice>
          )}
          {amelogenin.map((warning) => (
            <Notice key={`${warning.kind}-${warning.role}`}>
              {t(`warning.amel.${warning.kind}`, { who: roleLabel(t, warning.role, sex).toLowerCase() })}
            </Notice>
          ))}
          {result.computedCount < 10 && result.verdict !== "exclusion" && (
            <Notice tone="neutral">{t("warning.fewLoci", { n: result.computedCount })}</Notice>
          )}
          {missing.length > 0 && <Notice tone="neutral">{t("warning.noFrequencies", { loci: missing.join(", ") })}</Notice>}
        </div>
      )}

      {hasResult && (
        <Link href="/informe" className={buttonClass("primary", "w-full")}>
          {t("case.viewReport")}
        </Link>
      )}
    </aside>
  );
}

function Fact({
  label,
  value,
  detail,
  emphasis,
}: {
  label: string;
  value: string;
  /** A longer companion to the value (a list of markers), set on its own line. */
  detail?: string;
  emphasis?: boolean;
}) {
  const tone = emphasis ? "text-attention" : "text-ink";
  return (
    <div className="px-4 py-2.5 text-sm">
      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-muted">{label}</dt>
        <dd className={cn("text-right font-medium", tone)}>{value}</dd>
      </div>
      {detail && <dd className={cn("mt-0.5 leading-snug", tone)}>{detail}</dd>}
    </div>
  );
}

/** 99.99 stays 99.99; 99.9 does not become 99.90000000000001. */
export function trimPercent(value: number): string {
  return String(Number(value.toPrecision(10)));
}
