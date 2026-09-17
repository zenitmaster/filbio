"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { kitById, lociOfKit, type LocusId } from "@/lib/genetics";
import { roleLabel, useT, type MessageKey } from "@/lib/i18n";
import {
  bestKit,
  decodeExport,
  parseGeneMapper,
  suggestRoles,
  toProfile,
  type GeneMapperImport,
} from "@/lib/import/genemapper";
import { buildProfileTable, invalidCalls, parseProfileTable, type ProfileTable, type Profiles } from "@/lib/import/template";
import { SUBJECT_ROLES, useAppStore, type SubjectRole } from "@/lib/store";
import { Button, Field, Notice, Select, TextArea } from "./ui";

type Assignment = Record<SubjectRole, string>;
const NOBODY: Assignment = { known: "", child: "", alleged: "" };

/** What the text turned out to be. The two sources are told apart by their header row. */
type Loaded =
  | { format: "genemapper"; data: GeneMapperImport }
  | { format: "template"; data: ProfileTable }
  | { format: "unknown" };

function read(text: string): Loaded {
  const genemapper = parseGeneMapper(text);
  if (!genemapper.problems.some((problem) => problem.kind === "noHeader")) return { format: "genemapper", data: genemapper };
  const table = parseProfileTable(text);
  if (!table.problems.some((problem) => problem.kind === "noHeader")) return { format: "template", data: table };
  return { format: "unknown" };
}

/**
 * Brings profiles in from a file: the genotype table GeneMapper ID / ID-X
 * exports, or the CSV template this dialog hands out. Everything is read in the
 * browser.
 */
export function ProfileImport() {
  const t = useT();
  const caseData = useAppStore((state) => state.caseData);
  const kitId = useAppStore((state) => state.settings.kitId);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const importProfiles = useAppStore((state) => state.importProfiles);

  const dialog = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [assignment, setAssignment] = useState<Assignment>(NOBODY);
  const [clearOthers, setClearOthers] = useState(true);

  const { allegedSex, mode } = caseData;
  const kit = kitById(kitId);
  const label = (role: SubjectRole) => roleLabel(t, role, allegedSex);

  const load = (next: string) => {
    setText(next);
    const result = next.trim() ? read(next) : null;
    setLoaded(result);
    setAssignment({ ...NOBODY, ...(result?.format === "genemapper" ? suggestRoles(result.data.samples, allegedSex) : {}) });
  };

  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) load(decodeExport(await file.arrayBuffer()));
  };

  const reset = () => {
    setText("");
    setLoaded(null);
    setAssignment(NOBODY);
    setClearOthers(true);
  };

  // The template follows the case as it stands: its kit, its people, its language.
  const downloadTemplate = () => {
    const roles = SUBJECT_ROLES.filter((role) => mode === "trio" || role !== "known");
    const csv = buildProfileTable({
      loci: lociOfKit(kit),
      roles,
      labels: { known: label("known"), child: label("child"), alleged: label("alleged") },
      markerLabel: t("grid.marker"),
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `${t("import.template.filename")}-${kit.id}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Whatever the source, it comes down to a profile per person, plus remarks.
  const profiles: Profiles = {};
  const remarks: string[] = [];
  let markers: LocusId[] = [];
  let duplicated = false;

  if (loaded?.format === "genemapper") {
    markers = loaded.data.markers;
    const keys: string[] = [];
    for (const role of SUBJECT_ROLES) {
      const sample = loaded.data.samples.find((candidate) => candidate.key === assignment[role]);
      if (!sample) continue;
      keys.push(sample.key);
      const profile = toProfile(sample);
      profiles[role] = profile.alleles;
      for (const warning of profile.warnings) {
        remarks.push(t(`gm.warning.${warning.kind}`, { who: label(role), marker: warning.marker, alleles: warning.alleles.join(", ") }));
      }
    }
    duplicated = new Set(keys).size !== keys.length;
  } else if (loaded?.format === "template") {
    markers = loaded.data.markers;
    Object.assign(profiles, loaded.data.profiles);
    if (loaded.data.unknownMarkers.length) remarks.push(t("gm.unknownMarkers", { markers: loaded.data.unknownMarkers.join(", ") }));
    if (loaded.data.unknownColumns.length) remarks.push(t("gm.unknownColumns", { columns: loaded.data.unknownColumns.join(", ") }));
    for (const role of SUBJECT_ROLES) {
      for (const call of invalidCalls(profiles[role] ?? {})) {
        remarks.push(t("gm.warning.offLadder", { who: label(role), marker: call.marker, alleles: call.alleles.join(", ") }));
      }
    }
  }

  const chosen = SUBJECT_ROLES.filter((role) => profiles[role]);
  for (const role of chosen) {
    const missing = lociOfKit(kit).filter((locus) => !profiles[role]?.[locus]?.some((allele) => allele !== ""));
    if (missing.length > 0) remarks.push(t("gm.warning.missing", { who: label(role), markers: missing.join(", ") }));
  }
  const suggestedKit = markers.length > 0 ? bestKit(markers) : null;

  // People the file leaves out but who already have alleles typed in. Left alone,
  // a mother from an earlier case would quietly take part in this one's trio.
  const hasData = (role: SubjectRole) =>
    caseData.amelogenin[role].some((cell) => cell !== "") ||
    Object.values(caseData.alleles).some((entry) => entry[role].some((cell) => cell !== ""));
  const leftBehind = chosen.length > 0 ? SUBJECT_ROLES.filter((role) => !profiles[role] && hasData(role)) : [];

  const problems: string[] = [];
  if (loaded?.format === "unknown") problems.push(t("gm.problem.unrecognised"));
  if (loaded?.format === "genemapper") {
    for (const problem of loaded.data.problems) {
      problems.push(
        problem.kind === "conflict"
          ? t("gm.problem.conflict", { sample: problem.sample, marker: problem.marker })
          : t(`gm.problem.${problem.kind}` as MessageKey),
      );
    }
  }
  if (loaded?.format === "template" && loaded.data.problems.length > 0) problems.push(t("gm.problem.noRows"));

  return (
    <>
      <Button onClick={() => dialog.current?.showModal()}>{t("gm.open")}</Button>

      <dialog
        ref={dialog}
        onClose={reset}
        aria-labelledby="import-title"
        className="m-auto w-[min(46rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface p-0 text-text shadow-xl backdrop:bg-ink/40"
      >
        <div className="flex max-h-[85dvh] flex-col">
          <header className="border-b border-line px-5 py-3.5">
            <h2 id="import-title" className="text-base font-semibold text-ink">
              {t("gm.title")}
            </h2>
          </header>

          <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">
            <p className="text-sm leading-relaxed">{t("gm.intro")}</p>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <label className="cursor-pointer rounded-md border border-line-strong px-3 py-1.5 text-sm font-medium text-ink hover:bg-sunken has-focus-visible:outline-2 has-focus-visible:outline-focus">
                {t("gm.file")}
                <input type="file" accept=".csv,.txt,.tsv,text/csv,text/plain" onChange={readFile} className="sr-only" />
              </label>
              <Button variant="quiet" onClick={downloadTemplate} title={t("import.template.hint", { kit: kit.name })}>
                {t("import.template")}
              </Button>
            </div>
            <p className="-mt-2 text-xs leading-snug text-muted">{t("import.template.hint", { kit: kit.name })}</p>

            <Field label={t("gm.paste")}>
              {(props) => (
                <TextArea
                  {...props}
                  rows={4}
                  value={text}
                  onChange={(event) => load(event.target.value)}
                  spellCheck={false}
                  placeholder={`${t("grid.marker")},${label("child")} 1,${label("child")} 2,${label("alleged")} 1,${label("alleged")} 2`}
                  className="font-mono text-xs"
                />
              )}
            </Field>

            {loaded && (
              <div className="flex flex-col gap-3" aria-live="polite">
                {problems.map((problem) => (
                  <Notice key={problem} tone="invalid">
                    {problem}
                  </Notice>
                ))}

                {loaded.format === "genemapper" && loaded.data.samples.length > 0 && (
                  <>
                    <p className="text-sm font-medium text-ink">
                      {t("gm.format.genemapper")}: {t("gm.found", { samples: loaded.data.samples.length, markers: markers.length })}
                      {loaded.data.skipped.length > 0 && (
                        <span className="font-normal text-muted"> {t("gm.skipped", { markers: loaded.data.skipped.join(", ") })}</span>
                      )}
                    </p>
                    <fieldset className="grid gap-3 sm:grid-cols-3">
                      <legend className="mb-2 text-sm font-semibold text-ink">{t("gm.assign")}</legend>
                      {SUBJECT_ROLES.map((role) => (
                        <Field key={role} label={label(role)}>
                          {(props) => (
                            <Select
                              {...props}
                              value={assignment[role]}
                              onChange={(event) => setAssignment({ ...assignment, [role]: event.target.value })}
                            >
                              <option value="">{t("gm.none")}</option>
                              {loaded.data.samples.map((sample) => (
                                <option key={sample.key} value={sample.key}>
                                  {sample.label}
                                </option>
                              ))}
                            </Select>
                          )}
                        </Field>
                      ))}
                    </fieldset>
                  </>
                )}

                {loaded.format === "template" && chosen.length > 0 && (
                  <p className="text-sm font-medium text-ink">
                    {t("gm.format.template")}: {t("gm.people", { people: chosen.map(label).join(", "), markers: markers.length })}
                  </p>
                )}

                {suggestedKit && suggestedKit.id !== kitId && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Notice tone="neutral">{t("gm.kit", { kit: suggestedKit.name })}</Notice>
                    <Button onClick={() => updateSettings({ kitId: suggestedKit.id })}>
                      {t("gm.kit.switch", { kit: suggestedKit.name })}
                    </Button>
                  </div>
                )}

                {duplicated && <Notice tone="invalid">{t("gm.duplicate")}</Notice>}
                {chosen.length > 0 && remarks.length > 0 && (
                  <ul className="list-disc space-y-1 pl-5 text-sm leading-snug text-attention">
                    {remarks.map((remark) => (
                      <li key={remark}>{remark}</li>
                    ))}
                  </ul>
                )}
                {chosen.length > 0 && <p className="text-sm text-muted">{t("gm.replace")}</p>}
                {leftBehind.length > 0 && (
                  <label className="flex cursor-pointer items-start gap-2 rounded-md border border-attention/30 bg-attention-soft px-3 py-2 text-sm leading-snug text-text">
                    <input
                      type="checkbox"
                      checked={clearOthers}
                      onChange={(event) => setClearOthers(event.target.checked)}
                      className="mt-0.5 size-4 accent-ink"
                    />
                    {t("gm.clearOthers", { people: leftBehind.map(label).join(", ") })}
                  </label>
                )}
              </div>
            )}
          </div>

          <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">
            <Button onClick={() => dialog.current?.close()}>{t("case.cancel")}</Button>
            <Button
              variant="primary"
              disabled={chosen.length === 0 || duplicated}
              onClick={() => {
                importProfiles(profiles, { clearOthers: leftBehind.length > 0 && clearOthers });
                dialog.current?.close();
              }}
            >
              {t("gm.import")}
            </Button>
          </footer>
        </div>
      </dialog>
    </>
  );
}
