"use client";

import { Fragment, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import {
  formatFrequency,
  formatIndex,
  formatRate,
  parseAllele,
  repeatLengthOf,
  type LocusNote,
  type LocusResult,
} from "@/lib/genetics";
import { plural, roleCode, roleLabel, useLocale, useT, type Translate } from "@/lib/i18n";
import { useAppStore, type SubjectRole } from "@/lib/store";
import type { ParsedEntry } from "@/lib/store/parse";
import type { CaseView } from "@/lib/store/useCaseResult";
import { SEX_MARKER, useAllelePicker, type PickerCell } from "./AllelePicker";
import { FormulaView } from "./FormulaView";
import { DYE_VAR, LocusTrace, type TraceLane } from "./LocusTrace";
import { cn } from "./ui";

const AMEL_ROW = SEX_MARKER;

const CELL_INPUT =
  "h-8 w-13 rounded border bg-surface text-center text-sm text-ink " +
  "placeholder:text-faint focus-visible:outline-offset-0";

export function GenotypeGrid({ view }: { view: CaseView }) {
  const t = useT();
  const locale = useLocale();
  const caseData = useAppStore((state) => state.caseData);
  const setAllele = useAppStore((state) => state.setAllele);
  const setAlleles = useAppStore((state) => state.setAlleles);
  const setAmelogenin = useAppStore((state) => state.setAmelogenin);

  const [open, setOpen] = useState<string | null>(null);

  const { kit, loci, byLocus, parsed, population } = view;
  const roles: SubjectRole[] = caseData.mode === "trio" ? ["known", "child", "alleged"] : ["child", "alleged"];
  const rows = [...loci, AMEL_ROW];
  const columnCount = roles.length * 2;
  const indexLabel = t(`grid.index.${caseData.allegedSex}`);

  const slotOf = (column: number) => ({ role: roles[Math.floor(column / 2)], index: (column % 2) as 0 | 1 });

  // The dropdown of alleles behind every cell, fed by the selected population.
  const picker = useAllelePicker({
    frequenciesOf: (locus) => population.loci[locus],
    valueOf: ({ locus, column }) => {
      const { role, index } = slotOf(column);
      return locus === AMEL_ROW ? caseData.amelogenin[role][index] : (caseData.alleles[locus]?.[role][index] ?? "");
    },
    onPick: ({ locus, column }, value) => {
      const { role, index } = slotOf(column);
      if (locus === AMEL_ROW) setAmelogenin(role, index, value);
      else setAllele(locus, role, index, value);
    },
  });

  // The handlers sit on the table and work out the cell from the event target,
  // so ninety inputs share a handful of listeners.
  const cellOf = (target: EventTarget): (PickerCell & { input: HTMLInputElement }) | null => {
    if (!(target instanceof HTMLInputElement) || !target.dataset.cell) return null;
    const [row, column] = target.dataset.cell.split(":").map(Number);
    return { input: target, row, column, locus: rows[row] };
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
    const cell = cellOf(event.target);
    if (!cell) return;
    const { input, row, column } = cell;

    // While the list is open it owns the arrow keys, Enter and Escape.
    const outcome = picker.handleKey(event, cell, input);
    if (outcome === "handled") return;

    const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
    const atEnd = input.selectionStart === input.value.length;
    const everythingSelected =
      input.value.length > 0 && input.selectionStart === 0 && input.selectionEnd === input.value.length;

    let target: [number, number] | null = null;
    if (outcome === "moveDown") target = [row + 1, column];
    else if (event.key === "Enter") target = [row + (event.shiftKey ? -1 : 1), column];
    else if (event.key === "ArrowDown") target = [row + 1, column];
    else if (event.key === "ArrowUp") target = [row - 1, column];
    else if (event.key === "ArrowRight" && (atEnd || everythingSelected)) target = [row, column + 1];
    else if (event.key === "ArrowLeft" && (atStart || everythingSelected)) target = [row, column - 1];
    if (!target) return;

    event.preventDefault();
    const next = event.currentTarget.querySelector<HTMLInputElement>(`[data-cell="${target[0]}:${target[1]}"]`);
    next?.focus();
    next?.select();
  };

  // A block copied from a spreadsheet arrives as tab- and newline-separated text.
  const onPaste = (event: ClipboardEvent<HTMLTableElement>) => {
    const cell = cellOf(event.target);
    const text = event.clipboardData.getData("text/plain").replace(/\r?\n$/, "");
    if (!cell || !/[\t\n]/.test(text)) return;
    event.preventDefault();

    const cells: Parameters<typeof setAlleles>[0] = [];
    text.split(/\r?\n/).forEach((line, i) => {
      line.split("\t").forEach((raw, j) => {
        const [r, c] = [cell.row + i, cell.column + j];
        if (r >= rows.length || c >= columnCount) return;
        const role = roles[Math.floor(c / 2)];
        const index = (c % 2) as 0 | 1;
        const value = raw.trim();
        if (rows[r] === AMEL_ROW) setAmelogenin(role, index, value.toUpperCase());
        else cells.push({ locus: rows[r], role, index, value });
      });
    });
    setAlleles(cells);
  };

  const rowOf: Record<string, number> = Object.fromEntries(rows.map((name, index) => [name, index]));

  return (
    // `relative` makes this the containing block of the table's visually hidden
    // labels; otherwise they escape the scroller and widen the whole page.
    <div className="relative overflow-x-auto">
      <table
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        // A click opens the list of alleles (or closes it again); typing narrows it.
        onClick={(event) => {
          const cell = cellOf(event.target);
          if (!cell) return;
          if (picker.isOpenFor(cell)) picker.close();
          else picker.open(cell, cell.input, "");
        }}
        onChange={(event) => {
          const cell = cellOf(event.target);
          if (cell) picker.open(cell, cell.input, cell.input.value);
        }}
        onBlur={(event) => picker.handleBlur(event.relatedTarget)}
        className="w-full border-collapse text-sm"
      >
        <thead>
          <tr className="border-b border-line text-left text-muted">
            <th scope="col" className="py-2 pr-3 pl-4 font-medium">
              {t("grid.marker")}
            </th>
            {roles.map((role) => (
              <th key={role} scope="colgroup" colSpan={2} className="px-2 py-2 font-medium">
                {roleLabel(t, role, caseData.allegedSex)}
              </th>
            ))}
            <th scope="col" className="hidden px-3 py-2 font-medium md:table-cell">
              {t("grid.profile")}
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              {indexLabel}
            </th>
            <th scope="col" className="hidden px-3 py-2 font-medium xl:table-cell">
              {t("grid.formula")}
            </th>
            <th scope="col" className="w-10 py-2 pr-3">
              <span className="sr-only">{t("detail.frequencies")}</span>
            </th>
          </tr>
        </thead>

        {kit.panels.map((panel, panelIndex) => (
          <tbody key={panel.label} className={cn(panelIndex > 0 && "border-t-4 border-paper")}>
            {panel.loci.map((locus) => {
              const row = rowOf[locus];
              const result = byLocus[locus];
              const entry = parsed[locus];
              const isOpen = open === locus;
              return (
                <Fragment key={locus}>
                  <tr className="border-b border-line/70 hover:bg-sunken/50">
                    <th
                      scope="row"
                      title={t("grid.dye", { label: panel.label })}
                      className="border-l-[3px] py-1.5 pr-3 pl-3 text-left font-semibold whitespace-nowrap text-ink"
                      style={{ borderLeftColor: DYE_VAR[panel.dye] }}
                    >
                      {locus}
                    </th>

                    {roles.map((role, roleIndex) =>
                      ([0, 1] as const).map((index) => {
                        const column = roleIndex * 2 + index;
                        const invalid = entry[role].invalid[index];
                        const value = caseData.alleles[locus]?.[role][index] ?? "";
                        // A real allele that this population's table does not list:
                        // allowed, but worth a second look before it is believed.
                        const typed = parseAllele(value);
                        const table = population.loci[locus]?.freqs;
                        const unlisted = typed.ok && table !== undefined && table[typed.allele] === undefined;
                        const active = picker.isOpenFor({ row, column, locus });
                        return (
                          <td key={`${role}${index}`} className={cn("py-1", index === 0 ? "pr-0.5 pl-2" : "pr-2 pl-0.5")}>
                            <input
                              data-cell={`${row}:${column}`}
                              value={value}
                              inputMode="decimal"
                              autoComplete="off"
                              spellCheck={false}
                              role="combobox"
                              aria-autocomplete="list"
                              aria-haspopup="listbox"
                              aria-expanded={active}
                              aria-controls={active ? picker.listId : undefined}
                              aria-activedescendant={active ? picker.activeOptionId : undefined}
                              aria-label={`${locus}, ${roleLabel(t, role, caseData.allegedSex)}, ${t("grid.allele", { n: index + 1 })}`}
                              aria-invalid={invalid || undefined}
                              title={
                                invalid
                                  ? t("grid.invalid", { value })
                                  : unlisted
                                    ? t("grid.unlisted", { allele: typed.allele })
                                    : undefined
                              }
                              onChange={(event) => setAllele(locus, role, index, event.target.value)}
                              className={cn(
                                CELL_INPUT,
                                invalid
                                  ? "border-invalid bg-invalid-soft"
                                  : unlisted
                                    ? "border-dashed border-attention bg-attention-soft"
                                    : "border-line-strong hover:border-muted",
                              )}
                            />
                          </td>
                        );
                      }),
                    )}

                    <td className="hidden px-3 py-0.5 md:table-cell">
                      <LocusTrace
                        lanes={laneData(roles, entry, t, caseData.allegedSex)}
                        repeatLength={repeatLengthOf(locus)}
                        dye={panel.dye}
                        unexplained={unexplainedAlleles(result, entry)}
                        label={t("trace.label", { locus, description: describeLanes(roles, entry, t, caseData.allegedSex) })}
                      />
                    </td>

                    <td className="px-3 py-1.5 text-right whitespace-nowrap">
                      <IndexCell result={result} t={t} locale={locale} />
                    </td>

                    <td className="hidden px-3 py-1.5 whitespace-nowrap text-text xl:table-cell">
                      {result.formula ? (
                        <FormulaView formula={result.formula} />
                      ) : result.mutation ? (
                        <span className="text-attention">{t("detail.mutation")}</span>
                      ) : null}
                    </td>

                    <td className="py-1 pr-3 text-right">
                      {result.status === "computed" && (
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          aria-label={t("grid.details", { locus })}
                          onClick={() => setOpen(isOpen ? null : locus)}
                          className="inline-flex size-7 items-center justify-center rounded text-muted hover:bg-sunken hover:text-ink"
                        >
                          <svg
                            viewBox="0 0 16 16"
                            className={cn("size-4 transition-transform motion-reduce:transition-none", isOpen && "rotate-90")}
                            aria-hidden="true"
                          >
                            <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>

                  {isOpen && result.status === "computed" && (
                    <tr className="border-b border-line bg-sunken/60">
                      <td colSpan={columnCount + 5} className="px-4 py-3">
                        <LocusDetail result={result} entry={entry} roles={roles} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        ))}

        <tbody className="border-t-4 border-paper">
          <tr>
            <th scope="row" className="border-l-[3px] border-l-line-strong py-1.5 pr-3 pl-3 text-left font-semibold text-ink">
              {t("grid.amelogenin")}
            </th>
            {roles.map((role, roleIndex) =>
              ([0, 1] as const).map((index) => {
                const column = roleIndex * 2 + index;
                const value = caseData.amelogenin[role][index];
                const invalid = value.trim() !== "" && !/^[XY]$/i.test(value.trim());
                const active = picker.isOpenFor({ row: rows.length - 1, column, locus: AMEL_ROW });
                return (
                  <td key={`${role}${index}`} className={cn("py-1", index === 0 ? "pr-0.5 pl-2" : "pr-2 pl-0.5")}>
                    <input
                      data-cell={`${rows.length - 1}:${column}`}
                      value={value}
                      maxLength={1}
                      autoComplete="off"
                      spellCheck={false}
                      role="combobox"
                      aria-autocomplete="list"
                      aria-haspopup="listbox"
                      aria-expanded={active}
                      aria-controls={active ? picker.listId : undefined}
                      aria-activedescendant={active ? picker.activeOptionId : undefined}
                      aria-label={`${t("grid.amelogenin")}, ${roleLabel(t, role, caseData.allegedSex)}, ${index + 1}`}
                      aria-invalid={invalid || undefined}
                      title={invalid ? t("grid.invalidSex") : undefined}
                      onChange={(event) => setAmelogenin(role, index, event.target.value.toUpperCase())}
                      className={cn(
                        CELL_INPUT,
                        invalid ? "border-invalid bg-invalid-soft" : "border-line-strong hover:border-muted",
                      )}
                    />
                  </td>
                );
              }),
            )}
            <td colSpan={4} className="px-3 py-1.5 text-xs text-muted">
              {t("grid.amelogenin.hint")}
            </td>
          </tr>
        </tbody>
      </table>
      {/* Positioned against the viewport, so the scroller above does not clip it. */}
      {picker.popup}
    </div>
  );
}

function laneData(
  roles: SubjectRole[],
  entry: ParsedEntry,
  t: Translate,
  allegedSex: "male" | "female",
): TraceLane[] {
  return roles.map((role) => ({
    kind: role,
    code: roleCode(t, role, allegedSex),
    genotype: entry[role].genotype,
  }));
}

function describeLanes(
  roles: SubjectRole[],
  entry: ParsedEntry,
  t: Translate,
  allegedSex: "male" | "female",
): string {
  return roles
    .map((role) => `${roleLabel(t, role, allegedSex)} ${entry[role].genotype?.join(", ") ?? "—"}`)
    .join("; ");
}

/** Child alleles the alleged parent should carry but does not. */
function unexplainedAlleles(result: LocusResult, entry: ParsedEntry): string[] {
  if (!result.allegedInconsistent) return [];
  if (result.obligateAlleles.length > 0) return result.obligateAlleles;
  return [...new Set(entry.child.genotype ?? [])];
}

function IndexCell({ result, t, locale }: { result: LocusResult; t: Translate; locale: "es" | "en" }) {
  if (result.status === "noFrequencies") {
    return (
      <span className="text-xs whitespace-nowrap text-faint" title={t("grid.noFrequencies")}>
        {t("grid.noFrequencies.short")}
      </span>
    );
  }
  if (result.status !== "computed" || result.pi === undefined) {
    return <span className="text-faint">{t("grid.incomplete")}</span>;
  }
  const flagged = result.allegedInconsistent || result.knownInconsistent;
  return (
    <span className={cn("font-medium", flagged ? "text-attention" : "text-ink")}>
      {flagged && (
        <span className="mr-1.5 rounded-sm bg-attention-soft px-1 py-px text-xs font-semibold" title={t("detail.mutation")}>
          μ
        </span>
      )}
      {formatIndex(result.pi, locale)}
    </span>
  );
}

function LocusDetail({
  result,
  entry,
  roles,
}: {
  result: LocusResult;
  entry: ParsedEntry;
  roles: SubjectRole[];
}) {
  const t = useT();
  const locale = useLocale();
  const allegedSex = useAppStore((state) => state.caseData.allegedSex);
  const alleged = roleLabel(t, "alleged", allegedSex).toLowerCase();

  const assumed = roles.filter((role) => entry[role].assumedHomozygous);

  return (
    <div className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.6fr)]">
      <dl className="space-y-1.5">
        <div>
          <dt className="text-muted">{t("detail.obligate", { alleged })}</dt>
          <dd className="font-medium text-ink">
            {result.obligateAlleles.length ? result.obligateAlleles.join(" / ") : t("detail.obligate.none")}
          </dd>
        </div>
        <div>
          <dt className="text-muted">{t("grid.formula")}</dt>
          <dd className="text-ink">
            {result.formula ? (
              <>
                <FormulaView formula={result.formula} /> = {formatIndex(result.pi ?? 0, locale)}
              </>
            ) : result.mutation ? (
              <MutationSummary result={result} />
            ) : (
              t("detail.consistent")
            )}
          </dd>
        </div>
      </dl>

      <div>
        <h4 className="text-muted">{t("detail.frequencies")}</h4>
        <ul className="mt-0.5 space-y-0.5">
          {Object.entries(result.frequencies).map(([allele, found]) => (
            <li key={allele} className="text-ink">
              <span className="math">
                <i>p</i>
                <sub className="text-[0.7em]">{allele}</sub>
              </span>{" "}
              = {formatFrequency(found.p, locale)}
              {found.floored && (
                <span className="ml-1.5 text-xs text-attention">
                  {t("detail.frequency.minimum")}
                  {found.observed && `, ${t("detail.frequency.tabulated", { value: formatFrequency(found.tabulated, locale) })}`}
                </span>
              )}
            </li>
          ))}
          {Object.keys(result.frequencies).length === 0 && <li className="text-faint">—</li>}
        </ul>
      </div>

      {(result.notes.length > 0 || assumed.length > 0) && (
        <ul className="space-y-1 text-text sm:col-span-2 lg:col-span-1">
          {result.notes.map((note, index) => (
            <li key={index} className="leading-snug">
              {noteText(note, result, t, locale)}
            </li>
          ))}
          {assumed.map((role) => (
            <li key={role} className="leading-snug">
              {t("note.assumedHomozygous", { who: roleLabel(t, role, allegedSex).toLowerCase() })}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** One short line per fact: the model, the change it has to explain, the rate, the index. */
function MutationSummary({ result }: { result: LocusResult }) {
  const t = useT();
  const locale = useLocale();
  const mutation = result.mutation;
  if (!mutation) return null;
  const { event } = mutation;
  return (
    <ul className="space-y-0.5 text-attention">
      <li>
        {mutation.model === "aabb"
          ? t("detail.mutation.aabb", { power: formatFrequency(mutation.exclusionPower ?? 0, locale) })
          : t("detail.mutation.stepwise")}
      </li>
      {event && (
        <li>
          {t("detail.mutation.event", { from: event.from, to: event.to })},{" "}
          {event.steps === null
            ? t("detail.mutation.fractional")
            : plural(t, "detail.mutation.steps", event.steps)}
        </li>
      )}
      <li>
        <span className="math">
          <i>μ</i> = {formatRate(mutation.rate, locale)}
        </span>
        , {formatIndex(result.pi ?? 0, locale)}
      </li>
    </ul>
  );
}

function noteText(note: LocusNote, result: LocusResult, t: Translate, locale: "es" | "en"): string {
  switch (note.kind) {
    case "alleleUnobserved":
    case "frequencyFloored": {
      const found = result.frequencies[note.allele];
      return t(`note.${note.kind}`, {
        allele: note.allele,
        minimum: formatFrequency(found?.minimum ?? 0, locale),
        tabulated: formatFrequency(found?.tabulated ?? 0, locale),
      });
    }
    default:
      return t(`note.${note.kind}`);
  }
}
