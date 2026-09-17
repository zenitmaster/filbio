"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { KITS } from "@/lib/genetics";
import { roleCode, roleLabel, useLocale, useT } from "@/lib/i18n";
import { BUILTIN_POPULATIONS, POPULATION_GROUPS } from "@/lib/populations";
import { SUBJECT_ROLES, useAppStore, type CaseData, type Sex } from "@/lib/store";
import type { ExampleId } from "@/lib/store/examples";
import { Button, Field, Notice, Panel, Segmented, Select, TextInput } from "./ui";

export function CaseHeader() {
  const t = useT();
  const locale = useLocale();
  const caseData = useAppStore((state) => state.caseData);
  const settings = useAppStore((state) => state.settings);
  const customPopulations = useAppStore((state) => state.customPopulations);
  const updateCase = useAppStore((state) => state.updateCase);
  const updateSettings = useAppStore((state) => state.updateSettings);

  const sex = caseData.allegedSex;
  const populations = [...customPopulations, ...BUILTIN_POPULATIONS];

  return (
    <Panel
      title={caseData.caseId ? t("case.title", { id: caseData.caseId }) : t("case.new")}
      aside={<CaseActions />}
    >
      <div className="grid gap-x-4 gap-y-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <Field label={t("case.id")}>
          {(props) => (
            <TextInput
              {...props}
              value={caseData.caseId}
              onChange={(event) => updateCase({ caseId: event.target.value })}
              autoComplete="off"
            />
          )}
        </Field>
        <Field label={t("case.requester")}>
          {(props) => (
            <TextInput
              {...props}
              value={caseData.requester}
              onChange={(event) => updateCase({ requester: event.target.value })}
              autoComplete="off"
            />
          )}
        </Field>
        <Field label={t("case.received")}>
          {(props) => (
            <TextInput
              {...props}
              type="date"
              value={caseData.receivedOn}
              onChange={(event) => updateCase({ receivedOn: event.target.value })}
            />
          )}
        </Field>
        <Field label={t("case.kit")}>
          {(props) => (
            <Select {...props} value={settings.kitId} onChange={(event) => updateSettings({ kitId: event.target.value })}>
              {KITS.map((kit) => (
                <option key={kit.id} value={kit.id}>
                  {kit.name}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Segmented
          label={t("case.question")}
          value={sex}
          onChange={(allegedSex) => updateCase({ allegedSex })}
          options={[
            { value: "male", label: t("case.paternity") },
            { value: "female", label: t("case.maternity") },
          ]}
        />
        <div>
          <Segmented
            label={t("case.mode")}
            value={caseData.mode}
            onChange={(mode) => updateCase({ mode })}
            options={[
              { value: "trio", label: t("case.trio") },
              { value: "duo", label: t("case.duo") },
            ]}
          />
          <p className="mt-1 text-xs text-muted">{t(`case.${caseData.mode}.hint.${sex}`)}</p>
        </div>
        <Field label={t("case.population")} className="sm:col-span-2">
          {(props) => (
            <Select
              {...props}
              value={settings.populationId}
              onChange={(event) => updateSettings({ populationId: event.target.value })}
            >
              {POPULATION_GROUPS.map((group) => {
                const members = populations.filter((population) => population.group === group.id);
                if (members.length === 0) return null;
                return (
                  <optgroup key={group.id} label={group.name[locale]}>
                    {members.map((population) => (
                      <option key={population.id} value={population.id}>
                        {population.name[locale]}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </Select>
          )}
        </Field>
      </div>

      {/* Names only matter for the report, so they stay out of the way of data entry. */}
      <details className="group border-t border-line">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-medium text-text hover:bg-sunken/60 [&::-webkit-details-marker]:hidden">
          <svg viewBox="0 0 16 16" className="size-4 text-muted transition-transform group-open:rotate-90 motion-reduce:transition-none" aria-hidden="true">
            <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t("subjects.title")}
          <span className="font-normal text-muted">{subjectsSummary(caseData, t("subjects.summary.empty"))}</span>
        </summary>
        <div className="px-4 pt-1 pb-4">
          <Subjects />
        </div>
      </details>
    </Panel>
  );
}

function subjectsSummary(caseData: CaseData, empty: string): string {
  const roles = SUBJECT_ROLES.filter((role) => caseData.mode === "trio" || role !== "known");
  const names = roles.map((role) => caseData.subjects[role].name.trim()).filter(Boolean);
  return names.length ? names.join(", ") : empty;
}

function Subjects() {
  const t = useT();
  const caseData = useAppStore((state) => state.caseData);
  const updateSubject = useAppStore((state) => state.updateSubject);
  const roles = SUBJECT_ROLES.filter((role) => caseData.mode === "trio" || role !== "known");

  return (
    <table className="w-full border-separate border-spacing-x-3 border-spacing-y-1.5 text-sm">
      <thead>
        <tr className="text-left text-muted">
          <td />
          <th scope="col" className="font-medium">{t("subjects.name")}</th>
          <th scope="col" className="w-36 font-medium">{t("subjects.sex")}</th>
          <th scope="col" className="hidden w-40 font-medium sm:table-cell">{t("subjects.code")}</th>
        </tr>
      </thead>
      <tbody>
        {roles.map((role) => {
          const label = roleLabel(t, role, caseData.allegedSex);
          const code = roleCode(t, role, caseData.allegedSex);
          // A parent's sex follows from whose parentage is in question.
          const fixedSex: Sex | null =
            role === "alleged" ? caseData.allegedSex : role === "known" ? (caseData.allegedSex === "male" ? "female" : "male") : null;
          return (
            <tr key={role}>
              <th scope="row" className="w-40 text-left font-medium whitespace-nowrap text-text">
                {label}
              </th>
              <td>
                <TextInput
                  aria-label={`${label}: ${t("subjects.name")}`}
                  value={caseData.subjects[role].name}
                  onChange={(event) => updateSubject(role, { name: event.target.value })}
                  autoComplete="off"
                />
              </td>
              <td>
                <Select
                  aria-label={`${label}: ${t("subjects.sex")}`}
                  value={fixedSex ?? caseData.subjects[role].sex}
                  disabled={fixedSex !== null}
                  onChange={(event) => updateSubject(role, { sex: event.target.value as Sex })}
                >
                  <option value="">{t("sex.unknown")}</option>
                  <option value="female">{t("sex.female")}</option>
                  <option value="male">{t("sex.male")}</option>
                </Select>
              </td>
              <td className="hidden text-muted sm:table-cell">{caseData.caseId ? `${code}-${caseData.caseId}` : "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function CaseActions() {
  const t = useT();
  const caseData = useAppStore((state) => state.caseData);
  const loadExample = useAppStore((state) => state.loadExample);
  const clearCase = useAppStore((state) => state.clearCase);
  const replaceCase = useAppStore((state) => state.replaceCase);
  const fileInput = useRef<HTMLInputElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(false);

  const exportCase = () => {
    const blob = new Blob([JSON.stringify({ format: "filbio-case", version: 1, case: caseData }, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${caseData.caseId || "caso"}.filbio.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const importCase = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as { format?: string; case?: CaseData };
      if (parsed.format !== "filbio-case" || !parsed.case?.alleles) throw new Error("format");
      replaceCase(parsed.case);
      setError(false);
    } catch {
      setError(true);
    }
  };

  if (confirming) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-text">{t("case.clear.question")}</span>
        <Button
          variant="danger"
          onClick={() => {
            clearCase();
            setConfirming(false);
          }}
        >
          {t("case.clear.confirm")}
        </Button>
        <Button onClick={() => setConfirming(false)}>{t("case.cancel")}</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error && <Notice tone="invalid">{t("case.import.error")}</Notice>}
      <Select
        className="w-auto"
        aria-label={t("case.example")}
        value=""
        onChange={(event) => event.target.value && loadExample(event.target.value as ExampleId)}
      >
        <option value="">{t("case.example")}</option>
        <option value="trio">{t("case.example.trio")}</option>
        <option value="mutation">{t("case.example.mutation")}</option>
        <option value="exclusion">{t("case.example.exclusion")}</option>
      </Select>
      <Button onClick={() => fileInput.current?.click()}>{t("case.import")}</Button>
      <input ref={fileInput} type="file" accept=".json,application/json" onChange={importCase} className="sr-only" tabIndex={-1} aria-hidden="true" />
      <Button onClick={exportCase}>{t("case.export")}</Button>
      <Button variant="quiet" onClick={() => setConfirming(true)}>
        {t("case.clear")}
      </Button>
    </div>
  );
}
