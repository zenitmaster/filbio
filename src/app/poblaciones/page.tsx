"use client";

import { useState, type ChangeEvent } from "react";
import { FrequencyTable } from "@/components/FrequencyTable";
import { Button, cn, Field, Notice, Panel, Select, TextArea, TextInput } from "@/components/ui";
import { kitById, lociOfKit, type Population } from "@/lib/genetics";
import { useLocale, useT, type Translate } from "@/lib/i18n";
import { BUILTIN_POPULATIONS, findPopulation, POPULATION_GROUPS } from "@/lib/populations";
import { decodeExport } from "@/lib/import/csv";
import {
  buildCustomPopulation,
  frequencyTemplateCsv,
  parseFrequencyTable,
  populationToCsv,
  type ImportOptions,
  type ImportProblem,
} from "@/lib/populations/import";
import { useAppStore } from "@/lib/store";

export default function PopulationsPage() {
  const t = useT();
  const locale = useLocale();
  const settings = useAppStore((state) => state.settings);
  const custom = useAppStore((state) => state.customPopulations);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const savePopulation = useAppStore((state) => state.savePopulation);
  const removePopulation = useAppStore((state) => state.removePopulation);

  const [selectedId, setSelectedId] = useState(settings.populationId);
  const [draft, setDraft] = useState<Population | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const all = [...custom, ...BUILTIN_POPULATIONS];
  const selected = findPopulation(selectedId, custom);
  const shown = draft ?? selected;
  const kit = kitById(settings.kitId);
  const kitLoci = lociOfKit(kit);
  const missing = kitLoci.filter((locus) => !selected.loci[locus]);

  const select = (id: string) => {
    setSelectedId(id);
    setDraft(null);
    setConfirmDelete(false);
  };

  const duplicate = () => {
    const copy: Population = {
      ...structuredClone(selected),
      id: `custom-${Date.now().toString(36)}`,
      group: "custom",
      custom: true,
      name: {
        es: t("pop.copyName", { name: selected.name.es }),
        en: t("pop.copyName", { name: selected.name.en }),
      },
    };
    savePopulation(copy);
    setSelectedId(copy.id);
    setDraft(copy);
  };

  const exportCsv = () => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([populationToCsv(selected)], { type: "text/csv" }));
    link.download = `${selected.id}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="max-w-3xl">
        <h1 className="font-serif text-3xl font-semibold text-ink">{t("pop.title")}</h1>
        <p className="mt-2 leading-relaxed text-text">{t("pop.intro")}</p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[19rem_minmax(0,1fr)]">
        <nav aria-label={t("pop.title")} className="flex flex-col gap-4">
          {POPULATION_GROUPS.map((group) => {
            const members = all.filter((population) => population.group === group.id);
            if (members.length === 0) return null;
            return (
              <div key={group.id}>
                <h2 className="mb-1 px-2 text-sm font-semibold text-muted">{group.name[locale]}</h2>
                <ul>
                  {members.map((population) => (
                    <li key={population.id}>
                      <button
                        type="button"
                        onClick={() => select(population.id)}
                        aria-current={population.id === selectedId ? "true" : undefined}
                        className={cn(
                          "flex w-full items-baseline justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                          population.id === selectedId ? "bg-surface font-semibold text-ink shadow-sm ring-1 ring-line" : "text-text hover:bg-sunken",
                        )}
                      >
                        <span>{population.name[locale]}</span>
                        {population.id === settings.populationId && (
                          <span className="shrink-0 rounded-full bg-included-soft px-2 py-px text-xs font-medium text-included">
                            {t("pop.inUse")}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="flex min-w-0 flex-col gap-6">
          <Panel
            title={draft ? `${t("pop.editing")}: ${draft.name[locale]}` : selected.name[locale]}
            aside={
              draft ? (
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    onClick={() => {
                      savePopulation(draft);
                      setDraft(null);
                    }}
                  >
                    {t("pop.save")}
                  </Button>
                  <Button onClick={() => setDraft(null)}>{t("pop.cancel")}</Button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selected.id !== settings.populationId && (
                    <Button variant="primary" onClick={() => updateSettings({ populationId: selected.id })}>
                      {t("pop.use")}
                    </Button>
                  )}
                  {selected.custom && <Button onClick={() => setDraft(structuredClone(selected))}>{t("pop.edit")}</Button>}
                  <Button onClick={duplicate}>{t("pop.duplicate")}</Button>
                  <Button onClick={exportCsv}>{t("pop.export")}</Button>
                  {selected.custom &&
                    (confirmDelete ? (
                      <Button
                        variant="danger"
                        onClick={() => {
                          removePopulation(selected.id);
                          select(settings.populationId === selected.id ? BUILTIN_POPULATIONS[0].id : settings.populationId);
                        }}
                      >
                        {t("pop.delete.question", { name: selected.name[locale] })}
                      </Button>
                    ) : (
                      <Button variant="quiet" onClick={() => setConfirmDelete(true)}>
                        {t("pop.delete")}
                      </Button>
                    ))}
                </div>
              )
            }
          >
            <div className="flex flex-col gap-4 p-4">
              {draft ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("import.name")}>
                    {(props) => (
                      <TextInput
                        {...props}
                        value={draft.name[locale]}
                        onChange={(event) => setDraft({ ...draft, name: { es: event.target.value, en: event.target.value } })}
                      />
                    )}
                  </Field>
                  <Field label={t("import.citation")}>
                    {(props) => (
                      <TextInput
                        {...props}
                        value={draft.source.citation}
                        onChange={(event) => setDraft({ ...draft, source: { ...draft.source, citation: event.target.value } })}
                      />
                    )}
                  </Field>
                </div>
              ) : (
                <PopulationFacts population={selected} />
              )}

              {!draft && (
                <p className={cn("text-sm", missing.length ? "text-attention" : "text-muted")}>
                  {t("pop.covers", { n: kitLoci.length - missing.length, total: kitLoci.length, kit: kit.name })}
                  {missing.length > 0 && `. ${t("pop.missingLoci", { loci: missing.join(", ") })}`}
                </p>
              )}

              {/* Remounting on id/draft keeps the uncontrolled cells in step with the data shown. */}
              <FrequencyTable
                key={`${shown.id}-${draft ? "edit" : "view"}`}
                population={shown}
                onChange={draft ? setDraft : undefined}
              />
              {!draft && !selected.custom && <p className="text-sm text-muted">{t("pop.builtin.readonly")}</p>}
            </div>
          </Panel>

          <ImportPanel
            onSaved={(population) => {
              savePopulation(population);
              select(population.id);
            }}
          />
        </div>
      </div>
    </div>
  );
}

function PopulationFacts({ population }: { population: Population }) {
  const t = useT();
  const locale = useLocale();
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-muted">
        {population.individuals !== undefined && `${t("pop.individuals", { n: population.individuals })}, `}
        {t("pop.loci", { n: Object.keys(population.loci).length })}
      </p>
      <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[6rem_1fr]">
        <dt className="text-muted">{t("pop.source")}</dt>
        <dd className="leading-snug text-text">
          {population.source.citation}{" "}
          {population.source.url && (
            <a href={population.source.url} target="_blank" rel="noreferrer" className="break-all text-ink underline underline-offset-2">
              {population.source.url}
            </a>
          )}
        </dd>
        {population.source.license && (
          <>
            <dt className="text-muted">{t("pop.license")}</dt>
            <dd className="text-text">{population.source.license}</dd>
          </>
        )}
      </dl>
      {population.notes && (
        <div className="rounded-md border border-attention/30 bg-attention-soft px-3 py-2.5">
          <h3 className="font-semibold text-attention">{t("pop.notes")}</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 leading-snug text-text">
            {population.notes[locale].map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function problemText(problem: ImportProblem, t: Translate): string {
  switch (problem.kind) {
    case "noLoci":
      return t("import.problem.noLoci");
    case "unknownLocus":
      return t("import.problem.unknownLocus", { name: problem.name });
    case "badAllele":
      return t("import.problem.badAllele", { row: problem.row, value: problem.value });
    case "badValue":
      return t("import.problem.badValue", { locus: problem.locus, allele: problem.allele, value: problem.value });
    case "annotated":
      return t("import.problem.annotated", { locus: problem.locus, allele: problem.allele, value: problem.value, read: problem.read });
    case "sum":
      return t("import.problem.sum", { locus: problem.locus, sum: problem.sum.toFixed(3) });
  }
}

function ImportPanel({ onSaved }: { onSaved: (population: Population) => void }) {
  const t = useT();
  const kitId = useAppStore((state) => state.settings.kitId);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [citation, setCitation] = useState("");
  const [individuals, setIndividuals] = useState("");
  const [units, setUnits] = useState<ImportOptions["units"]>("auto");
  const [filler, setFiller] = useState("");
  const [attempted, setAttempted] = useState(false);

  const fillerValue = filler.trim() === "" ? null : Number(filler.replace(",", "."));
  const parsed = text.trim()
    ? parseFrequencyTable(text, { units, filler: Number.isFinite(fillerValue) ? fillerValue : null })
    : null;
  const n = Number(individuals);
  const canSave = Boolean(parsed && parsed.lociCount > 0 && name.trim() && n > 0);

  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setText(decodeExport(await file.arrayBuffer()));
    if (!name) setName(file.name.replace(/\.[^.]+$/, ""));
  };

  // Columns for the markers of the kit in use; the analyst fills in the rows.
  const downloadTemplate = () => {
    const csv = frequencyTemplateCsv(lociOfKit(kitById(kitId)), t("pop.allele"));
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `${t("import.template.filename")}-${t("import.template.frequencies")}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const save = () => {
    setAttempted(true);
    if (!parsed || !canSave) return;
    onSaved(buildCustomPopulation({ name: name.trim(), citation: citation.trim(), individuals: n, loci: parsed.loci }));
    setText("");
    setName("");
    setCitation("");
    setIndividuals("");
    setFiller("");
    setAttempted(false);
  };

  return (
    <Panel title={t("import.title")}>
      <div className="flex flex-col gap-4 p-4">
        <p className="max-w-3xl text-sm leading-relaxed text-text">{t("import.body")}</p>

        <Field label={t("import.paste")}>
          {(props) => (
            <TextArea
              {...props}
              rows={6}
              value={text}
              onChange={(event) => setText(event.target.value)}
              spellCheck={false}
              placeholder={"Allele\tD8S1179\tD21S11\t…\n8\t0.7\t\n9\t1.1\t"}
              className="font-mono text-xs"
            />
          )}
        </Field>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium text-ink">
          <label className="cursor-pointer underline underline-offset-2 has-focus-visible:outline-2 has-focus-visible:outline-focus">
            {t("import.file")}
            <input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" onChange={readFile} className="sr-only" />
          </label>
          <button type="button" onClick={downloadTemplate} className="cursor-pointer underline underline-offset-2">
            {t("import.template")}
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t("import.name")}>
            {(props) => <TextInput {...props} value={name} onChange={(event) => setName(event.target.value)} />}
          </Field>
          <Field label={t("import.individuals")} hint={t("import.individuals.hint")}>
            {(props) => (
              <TextInput {...props} inputMode="numeric" value={individuals} onChange={(event) => setIndividuals(event.target.value)} />
            )}
          </Field>
          <Field label={t("import.units")}>
            {(props) => (
              <Select {...props} value={units} onChange={(event) => setUnits(event.target.value as ImportOptions["units"])}>
                <option value="auto">{t("import.units.auto")}</option>
                <option value="percent">{t("import.units.percent")}</option>
                <option value="proportion">{t("import.units.proportion")}</option>
              </Select>
            )}
          </Field>
          <Field label={t("import.filler")} hint={t("import.filler.hint")}>
            {(props) => <TextInput {...props} inputMode="decimal" value={filler} onChange={(event) => setFiller(event.target.value)} />}
          </Field>
          <Field label={t("import.citation")} className="sm:col-span-2 lg:col-span-4">
            {(props) => <TextInput {...props} value={citation} onChange={(event) => setCitation(event.target.value)} />}
          </Field>
        </div>

        {parsed && (
          <div className="flex flex-col gap-2" aria-live="polite">
            <p className="text-sm font-medium text-ink">
              {t("import.preview")}: {t("import.recognized", { loci: parsed.lociCount, alleles: parsed.alleleCount })}
              {parsed.lociCount > 0 && `, ${t(`import.detected.${parsed.units}`)}`}
            </p>
            {parsed.suggestedFiller !== null && fillerValue === null && (
              <div className="flex flex-wrap items-center gap-2">
                <Notice>{t("import.suggestFiller", { value: parsed.suggestedFiller })}</Notice>
                <Button onClick={() => setFiller(String(parsed.suggestedFiller))}>
                  {t("import.suggestFiller.apply", { value: parsed.suggestedFiller })}
                </Button>
              </div>
            )}
            {parsed.problems.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-5 text-sm text-attention">
                {parsed.problems.slice(0, 12).map((problem, index) => (
                  <li key={index}>{problemText(problem, t)}</li>
                ))}
                {parsed.problems.length > 12 && <li>… +{parsed.problems.length - 12}</li>}
              </ul>
            )}
          </div>
        )}

        {attempted && !name.trim() && <Notice tone="invalid">{t("import.problem.needName")}</Notice>}
        {attempted && !(n > 0) && <Notice tone="invalid">{t("import.problem.needN")}</Notice>}

        <Button variant="primary" className="w-fit" onClick={save} disabled={!parsed || parsed.lociCount === 0}>
          {t("import.save")}
        </Button>
      </div>
    </Panel>
  );
}
