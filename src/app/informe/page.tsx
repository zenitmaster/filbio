"use client";

import Link from "next/link";
import { Button, buttonClass, cn, Field, Notice, TextInput } from "@/components/ui";
import { formatIndex, hasAllele } from "@/lib/genetics";
import { roleCode, roleLabel, rolePhrase, useLocale, useT } from "@/lib/i18n";
import { buildReport, formatDate, todayIso, type RoleWording } from "@/lib/report/text";
import { SUBJECT_ROLES, useAppStore, type SubjectRole } from "@/lib/store";
import { useCaseResult } from "@/lib/store/useCaseResult";

export default function ReportPage() {
  const t = useT();
  const locale = useLocale();
  const view = useCaseResult();
  const caseData = useAppStore((state) => state.caseData);
  const settings = useAppStore((state) => state.settings);
  const updateCase = useAppStore((state) => state.updateCase);

  const sex = caseData.allegedSex;
  const roles: SubjectRole[] = SUBJECT_ROLES.filter((role) => caseData.mode === "trio" || role !== "known");
  const labels = Object.fromEntries(
    SUBJECT_ROLES.map((role) => [role, roleLabel(t, role, sex)]),
  ) as Record<SubjectRole, string>;

  if (view.result.verdict === "empty") {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-start gap-4 py-10">
        <h1 className="font-serif text-2xl font-semibold text-ink">{t("report.heading")}</h1>
        <p className="text-text">{t("report.empty")}</p>
        <Link href="/" className={buttonClass("primary")}>
          {t("report.back")}
        </Link>
      </div>
    );
  }

  const wording = Object.fromEntries(
    SUBJECT_ROLES.map((role) => [role, { phrase: rolePhrase(t, role, sex), code: roleCode(t, role, sex) }]),
  ) as Record<SubjectRole, RoleWording>;
  const report = buildReport(view, caseData, settings, locale, wording);
  const issued = caseData.reportDate || todayIso();
  const lab = settings.lab;
  const missingLab = !lab.name || !lab.signerName;

  return (
    <div className="mx-auto max-w-[52rem]">
      <div className="mb-6 flex flex-wrap items-end gap-3 print:hidden">
        <Link href="/" className={buttonClass("secondary")}>
          {t("report.back")}
        </Link>
        <Field label={t("report.date")}>
          {(props) => (
            <TextInput
              {...props}
              type="date"
              value={issued}
              onChange={(event) => updateCase({ reportDate: event.target.value })}
              className="w-44"
            />
          )}
        </Field>
        <Button variant="primary" className="ml-auto" onClick={() => window.print()}>
          {t("report.print")}
        </Button>
      </div>

      {missingLab && (
        <div className="mb-4 print:hidden">
          <Notice tone="neutral">
            {t("report.missingLab")}{" "}
            <Link href="/ajustes" className="font-medium underline underline-offset-2">
              {t("nav.settings")}
            </Link>
          </Notice>
        </div>
      )}

      <article className="rounded-lg border border-line bg-surface px-8 py-10 font-serif text-[0.97rem] leading-relaxed text-ink sm:px-14 print:border-0 print:p-0 print:text-[10.5pt] print:leading-normal">
        <header className="border-b-2 border-ink pb-4">
          {lab.name && <p className="font-sans text-sm font-semibold tracking-wide text-muted">{lab.name}</p>}
          <h1 className="mt-1 text-[1.75rem] leading-tight font-semibold">{t("report.heading")}</h1>
          <dl className="mt-4 grid gap-x-8 gap-y-1 font-sans text-sm sm:grid-cols-2 print:grid-cols-2">
            <Meta label={t("report.number")} value={caseData.caseId ? `P-${caseData.caseId}` : "—"} />
            <Meta label={t("report.date")} value={formatDate(issued, locale)} />
            <Meta label={t("case.requester")} value={caseData.requester || "—"} />
            <Meta label={t("report.study")} value={t("report.study.value")} />
          </dl>
        </header>

        <Section title={t("report.section.basis")}>
          <p>{report.basis}</p>
        </Section>

        <Section title={t("report.section.description")}>
          <p>{report.description}</p>
        </Section>

        <Section title={t("report.section.subjects")}>
          <table className="w-full border-collapse font-sans text-sm">
            <thead>
              <tr className="border-b border-ink/40 text-left">
                <th className="py-1.5 pr-4 font-semibold">{t("subjects.title")}</th>
                <th className="py-1.5 pr-4 font-semibold">{t("subjects.name")}</th>
                <th className="py-1.5 pr-4 font-semibold">{t("subjects.sex")}</th>
                <th className="py-1.5 font-semibold">{t("subjects.code")}</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => {
                const fixed = role === "alleged" ? sex : role === "known" ? (sex === "male" ? "female" : "male") : caseData.subjects.child.sex;
                return (
                  <tr key={role} className="border-b border-line">
                    <td className="py-1.5 pr-4">{labels[role]}</td>
                    <td className="py-1.5 pr-4">{caseData.subjects[role].name || "—"}</td>
                    <td className="py-1.5 pr-4">{fixed ? t(`sex.${fixed}`) : "—"}</td>
                    <td className="py-1.5">{caseData.caseId ? `${roleCode(t, role, sex)}-${caseData.caseId}` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>

        <Section title={t("report.section.method")}>
          {report.method.map((paragraph, index) => (
            <p key={index} className="mt-2 first:mt-0">
              {paragraph}
            </p>
          ))}
        </Section>

        <Section title={t("report.section.results")}>
          <p>{report.resultsIntro}</p>
          {/* Seven columns do not fit a phone; on paper the table is never clipped. */}
          <div className="relative overflow-x-auto print:overflow-visible">
          <table className="mt-3 w-full border-collapse font-sans text-sm break-inside-avoid">
            <thead>
              <tr className="border-b border-ink/40">
                <th className="py-1.5 pr-3 text-left font-semibold">{t("grid.marker")}</th>
                {roles.map((role) => (
                  <th key={role} colSpan={2} className="px-2 py-1.5 text-center font-semibold">
                    {labels[role]}
                  </th>
                ))}
                <th className="py-1.5 pl-3 text-right font-semibold">{t(`grid.index.${sex}`)}</th>
              </tr>
            </thead>
            <tbody>
              {view.loci.map((locus) => {
                const locusResult = view.byLocus[locus];
                const entry = view.parsed[locus];
                const allegedGenotype = entry.alleged.genotype;
                const flagged = locusResult.allegedInconsistent;
                return (
                  <tr key={locus} className={cn("border-b border-line", flagged && "bg-attention-soft print:bg-transparent")}>
                    <td className="py-1 pr-3 font-medium">{locus}</td>
                    {roles.map((role) => {
                      const genotype = entry[role].genotype;
                      return [0, 1].map((index) => {
                        const allele = genotype?.[index];
                        // Bold marks a child allele that the alleged parent also carries.
                        const shared = role === "child" && allele && allegedGenotype && hasAllele(allegedGenotype, allele);
                        return (
                          <td key={`${role}${index}`} className={cn("px-2 py-1 text-center", shared && "font-bold")}>
                            {allele ?? "—"}
                          </td>
                        );
                      });
                    })}
                    <td className="py-1 pl-3 text-right">
                      {locusResult.pi !== undefined ? formatIndex(locusResult.pi, locale) : "—"}
                      {flagged && <span className="ml-1 text-xs">({t("report.mutation")})</span>}
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td className="py-1 pr-3 font-medium">AMEL</td>
                {roles.map((role) =>
                  [0, 1].map((index) => (
                    <td key={`${role}${index}`} className="px-2 py-1 text-center">
                      {caseData.amelogenin[role][index] || "—"}
                    </td>
                  )),
                )}
                <td />
              </tr>
            </tbody>
          </table>
          </div>
        </Section>

        <Section title={t("report.section.statistics")}>
          <dl className="grid gap-y-1 font-sans sm:grid-cols-[auto_1fr] sm:gap-x-6 print:grid-cols-[auto_1fr] print:gap-x-6">
            <dt className="text-muted print:text-black">{t(`result.cpi.${sex}`)}</dt>
            <dd className="font-semibold">{report.cpi}</dd>
            <dt className="text-muted print:text-black">{t(`result.posterior.${sex}`)}</dt>
            <dd className="font-semibold">{report.probability}</dd>
          </dl>
        </Section>

        <Section title={t("report.section.considerations")}>
          <ol className="space-y-2">
            {report.considerations.map((item) => (
              <li key={item.title}>
                <span className="font-semibold">{item.title}.</span> {item.body}
              </li>
            ))}
          </ol>
        </Section>

        <Section title={t("report.section.conclusion")}>
          {report.conclusion.map((paragraph, index) => (
            <p key={index} className="mt-2 first:mt-0">
              {paragraph}
            </p>
          ))}
        </Section>

        <Section title={t("report.section.comments")}>
          <p>{t("report.comment")}</p>
          {lab.contact && <p className="mt-2">{lab.contact}</p>}
        </Section>

        <footer className="mt-16 break-inside-avoid text-center font-sans text-sm">
          <div className="mx-auto w-64 border-t border-ink pt-2">
            <p className="font-semibold">{lab.signerName || " "}</p>
            <p className="text-muted print:text-black">{lab.signerTitle}</p>
          </div>
        </footer>
      </article>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted print:text-black">{label}:</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7 print:mt-5">
      <h2 className="mb-2 font-sans text-sm font-semibold tracking-wide text-ink uppercase">{title}</h2>
      {children}
    </section>
  );
}
