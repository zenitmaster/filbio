"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { kitById, lociOfKit } from "@/lib/genetics";
import { roleLabel, useT, type MessageKey, type Translate } from "@/lib/i18n";
import {
  bestKit,
  decodeExport,
  parseGeneMapper,
  suggestRoles,
  toProfile,
  type GeneMapperImport as Parsed,
  type GeneMapperProblem,
} from "@/lib/import/genemapper";
import { SUBJECT_ROLES, useAppStore, type SubjectRole } from "@/lib/store";
import { Button, Field, Notice, Select, TextArea } from "./ui";

type Assignment = Record<SubjectRole, string>;
const NOBODY: Assignment = { known: "", child: "", alleged: "" };

function problemText(problem: GeneMapperProblem, t: Translate): string {
  if (problem.kind === "conflict") return t("gm.problem.conflict", { sample: problem.sample, marker: problem.marker });
  return t(`gm.problem.${problem.kind}` as MessageKey);
}

/** Brings profiles in from the genotype table that GeneMapper ID / ID-X exports. */
export function GeneMapperImport() {
  const t = useT();
  const allegedSex = useAppStore((state) => state.caseData.allegedSex);
  const kitId = useAppStore((state) => state.settings.kitId);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const importProfiles = useAppStore((state) => state.importProfiles);

  const dialog = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [assignment, setAssignment] = useState<Assignment>(NOBODY);

  const load = (next: string) => {
    setText(next);
    const result = next.trim() ? parseGeneMapper(next) : null;
    setParsed(result);
    setAssignment({ ...NOBODY, ...(result ? suggestRoles(result.samples, allegedSex) : {}) });
  };

  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) load(decodeExport(await file.arrayBuffer()));
  };

  const reset = () => {
    setText("");
    setParsed(null);
    setAssignment(NOBODY);
  };

  const kit = kitById(kitId);
  const suggestedKit = parsed ? bestKit(parsed.markers) : null;
  const sampleOf = (role: SubjectRole) => parsed?.samples.find((sample) => sample.key === assignment[role]);
  const chosen = SUBJECT_ROLES.filter((role) => sampleOf(role));
  const keys = chosen.map((role) => assignment[role]);
  const duplicated = new Set(keys).size !== keys.length;

  const warnings: string[] = [];
  for (const role of chosen) {
    const sample = sampleOf(role);
    if (!sample) continue;
    const who = roleLabel(t, role, allegedSex);
    for (const warning of toProfile(sample).warnings) {
      warnings.push(t(`gm.warning.${warning.kind}`, { who, marker: warning.marker, alleles: warning.alleles.join(", ") }));
    }
    const missing = lociOfKit(kit).filter((locus) => !sample.markers[locus]?.length);
    if (missing.length > 0) warnings.push(t("gm.warning.missing", { who, markers: missing.join(", ") }));
  }

  const runImport = () => {
    const profiles: Partial<Record<SubjectRole, Record<string, [string, string]>>> = {};
    for (const role of chosen) {
      const sample = sampleOf(role);
      if (sample) profiles[role] = toProfile(sample).alleles;
    }
    importProfiles(profiles);
    dialog.current?.close();
  };

  return (
    <>
      <Button onClick={() => dialog.current?.showModal()}>{t("gm.open")}</Button>

      <dialog
        ref={dialog}
        onClose={reset}
        aria-labelledby="gm-title"
        className="m-auto w-[min(46rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface p-0 text-text shadow-xl backdrop:bg-ink/40"
      >
        <div className="flex max-h-[85dvh] flex-col">
          <header className="border-b border-line px-5 py-3.5">
            <h2 id="gm-title" className="text-base font-semibold text-ink">
              {t("gm.title")}
            </h2>
          </header>

          <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">
            <p className="text-sm leading-relaxed">{t("gm.intro")}</p>

            <div className="flex flex-col gap-2">
              <label className="w-fit cursor-pointer rounded-md border border-line-strong px-3 py-1.5 text-sm font-medium text-ink hover:bg-sunken has-focus-visible:outline-2 has-focus-visible:outline-focus">
                {t("gm.file")}
                <input type="file" accept=".txt,.csv,.tsv,text/plain,text/csv" onChange={readFile} className="sr-only" />
              </label>
              <Field label={t("gm.paste")}>
                {(props) => (
                  <TextArea
                    {...props}
                    rows={4}
                    value={text}
                    onChange={(event) => load(event.target.value)}
                    spellCheck={false}
                    placeholder={"Sample Name\tMarker\tAllele 1\tAllele 2"}
                    className="font-mono text-xs"
                  />
                )}
              </Field>
            </div>

            {parsed && (
              <div className="flex flex-col gap-3" aria-live="polite">
                {parsed.problems.map((problem, index) => (
                  <Notice key={index} tone={problem.kind === "conflict" ? "attention" : "invalid"}>
                    {problemText(problem, t)}
                  </Notice>
                ))}

                {parsed.samples.length > 0 && (
                  <>
                    <p className="text-sm font-medium text-ink">
                      {t("gm.found", { samples: parsed.samples.length, markers: parsed.markers.length })}
                      {parsed.skipped.length > 0 && (
                        <span className="font-normal text-muted"> {t("gm.skipped", { markers: parsed.skipped.join(", ") })}</span>
                      )}
                    </p>

                    {suggestedKit && suggestedKit.id !== kitId && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Notice tone="neutral">{t("gm.kit", { kit: suggestedKit.name })}</Notice>
                        <Button onClick={() => updateSettings({ kitId: suggestedKit.id })}>
                          {t("gm.kit.switch", { kit: suggestedKit.name })}
                        </Button>
                      </div>
                    )}

                    <fieldset className="grid gap-3 sm:grid-cols-3">
                      <legend className="mb-2 text-sm font-semibold text-ink">{t("gm.assign")}</legend>
                      {SUBJECT_ROLES.map((role) => (
                        <Field key={role} label={roleLabel(t, role, allegedSex)}>
                          {(props) => (
                            <Select
                              {...props}
                              value={assignment[role]}
                              onChange={(event) => setAssignment({ ...assignment, [role]: event.target.value })}
                            >
                              <option value="">{t("gm.none")}</option>
                              {parsed.samples.map((sample) => (
                                <option key={sample.key} value={sample.key}>
                                  {sample.label}
                                </option>
                              ))}
                            </Select>
                          )}
                        </Field>
                      ))}
                    </fieldset>

                    {duplicated && <Notice tone="invalid">{t("gm.duplicate")}</Notice>}
                    {warnings.length > 0 && (
                      <ul className="list-disc space-y-1 pl-5 text-sm leading-snug text-attention">
                        {warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    )}
                    {chosen.length > 0 && <p className="text-sm text-muted">{t("gm.replace")}</p>}
                  </>
                )}
              </div>
            )}
          </div>

          <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">
            <Button onClick={() => dialog.current?.close()}>{t("case.cancel")}</Button>
            <Button variant="primary" disabled={chosen.length === 0 || duplicated} onClick={runImport}>
              {t("gm.import")}
            </Button>
          </footer>
        </div>
      </dialog>
    </>
  );
}
