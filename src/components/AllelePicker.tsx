"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type Ref } from "react";
import { compareAlleles, formatFrequency, parseAllele, SEX_MARKER, type LocusFrequencies } from "@/lib/genetics";
import { useLocale, useT } from "@/lib/i18n";
import { cn } from "./ui";

export { SEX_MARKER };

/**
 * The dropdown behind every allele cell. A cell is a combobox: clicking it lists
 * the alleles the selected population has for that marker, each with its
 * frequency, and typing narrows the list. Anything typed is kept, so an allele
 * missing from the table can still be entered; it is offered explicitly as a
 * custom value. One popup serves the whole grid.
 */

export interface PickerCell {
  row: number;
  column: number;
  /** Marker name, or SEX_MARKER for the amelogenin row. */
  locus: string;
}

interface PickerState extends PickerCell {
  anchor: { left: number; top: number; bottom: number; width: number };
  /** What the user has typed since the list opened; "" lists everything. */
  filter: string;
  /** Index into the visible options, or -1 when nothing is highlighted. */
  highlight: number;
}

export type PickerOption =
  | { kind: "allele"; value: string; frequency?: number }
  /** A valid allele the table does not list. */
  | { kind: "custom"; value: string }
  /** "Another allele...": hands the cell back to the keyboard. */
  | { kind: "other" };

export function optionsFor(
  locus: string,
  frequencies: LocusFrequencies | undefined,
  filter: string,
): PickerOption[] {
  if (locus === SEX_MARKER) {
    return (["X", "Y"] as const)
      .filter((value) => value.startsWith(filter.toUpperCase()))
      .map((value) => ({ kind: "allele", value }));
  }

  const typed = filter.trim().replace(",", ".");
  const listed: PickerOption[] = Object.entries(frequencies?.freqs ?? {})
    .sort(([a], [b]) => compareAlleles(a, b))
    .filter(([allele]) => allele.startsWith(typed))
    .map(([value, frequency]) => ({ kind: "allele", value, frequency }));

  if (typed === "") return [...listed, { kind: "other" }];

  const parsed = parseAllele(typed);
  const isListed = parsed.ok && frequencies?.freqs[parsed.allele] !== undefined;
  return parsed.ok && !isListed ? [...listed, { kind: "custom", value: parsed.allele }] : listed;
}

const POPUP_HEIGHT = 264;

export function useAllelePicker({
  frequenciesOf,
  valueOf,
  onPick,
}: {
  frequenciesOf: (locus: string) => LocusFrequencies | undefined;
  valueOf: (cell: PickerCell) => string;
  onPick: (cell: PickerCell, value: string) => void;
}) {
  const [state, setState] = useState<PickerState | null>(null);
  const listId = useId();
  const popupRef = useRef<HTMLDivElement>(null);

  const options = state ? optionsFor(state.locus, frequenciesOf(state.locus), state.filter) : [];
  const close = () => setState(null);

  const open = (cell: PickerCell, input: HTMLInputElement, filter: string) => {
    const rect = input.getBoundingClientRect();
    const visible = optionsFor(cell.locus, frequenciesOf(cell.locus), filter);
    // Opened by a click, point at the current value. While typing, highlight only
    // an exact match: Enter must never swap what was typed for a near miss.
    const wanted = (filter || valueOf(cell)).trim().replace(",", ".").toUpperCase();
    const highlight = visible.findIndex((option) => option.kind === "allele" && option.value.toUpperCase() === wanted);
    setState({
      ...cell,
      anchor: { left: rect.left, top: rect.top, bottom: rect.bottom, width: rect.width },
      filter,
      highlight,
    });
  };

  const isOpenFor = (cell: PickerCell) => state?.row === cell.row && state.column === cell.column;

  const choose = (option: PickerOption, input: HTMLInputElement | null) => {
    if (!state) return;
    if (option.kind !== "other") onPick(state, option.value);
    close();
    input?.focus();
    // "Another allele": select what is there so that typing replaces it.
    if (option.kind === "other") input?.select();
  };

  /** Returns "moveDown" when Enter picked a value and the grid should advance. */
  const handleKey = (event: KeyboardEvent, cell: PickerCell, input: HTMLInputElement): "handled" | "moveDown" | null => {
    if (!isOpenFor(cell)) {
      if (event.key === "F4" || (event.altKey && event.key === "ArrowDown")) {
        event.preventDefault();
        open(cell, input, "");
        return "handled";
      }
      return null;
    }
    if (!state) return null;

    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        if (options.length === 0) return "handled";
        const step = event.key === "ArrowDown" ? 1 : -1;
        const next = state.highlight < 0 && step < 0 ? options.length - 1 : (state.highlight + step + options.length) % options.length;
        setState({ ...state, highlight: next });
        return "handled";
      }
      case "Enter": {
        const option = options[state.highlight];
        if (!option) {
          close();
          return null;
        }
        event.preventDefault();
        choose(option, input);
        return option.kind === "other" ? "handled" : "moveDown";
      }
      case "Escape":
        event.preventDefault();
        close();
        return "handled";
      case "Tab":
        close();
        return null;
      default:
        return null;
    }
  };

  // The popup is positioned against the viewport, so it cannot follow a scroll.
  useEffect(() => {
    if (!state) return;
    const dismiss = (event: Event) => {
      if (event.target instanceof Node && popupRef.current?.contains(event.target)) return;
      setState(null);
    };
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [state]);

  useEffect(() => {
    if (state && state.highlight >= 0) {
      document.getElementById(`${listId}-${state.highlight}`)?.scrollIntoView({ block: "nearest" });
    }
  }, [state, listId]);

  return {
    listId,
    isOpenFor,
    activeOptionId: state && state.highlight >= 0 ? `${listId}-${state.highlight}` : undefined,
    open,
    close,
    handleKey,
    /** Focus leaving the grid closes the list; focus never enters the popup itself. */
    handleBlur: (next: EventTarget | null) => {
      if (next instanceof Node && popupRef.current?.contains(next)) return;
      close();
    },
    popup: state && (
      <AllelePopup
        ref={popupRef}
        listId={listId}
        state={state}
        options={options}
        hasTable={state.locus === SEX_MARKER || Boolean(frequenciesOf(state.locus))}
        onHover={(highlight) => setState({ ...state, highlight })}
        onChoose={(option) =>
          choose(option, document.querySelector<HTMLInputElement>(`[data-cell="${state.row}:${state.column}"]`))
        }
      />
    ),
  };
}

function AllelePopup({
  ref,
  listId,
  state,
  options,
  hasTable,
  onHover,
  onChoose,
}: {
  ref: Ref<HTMLDivElement>;
  listId: string;
  state: PickerState;
  options: PickerOption[];
  hasTable: boolean;
  onHover: (index: number) => void;
  onChoose: (option: PickerOption) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const { anchor } = state;
  const above = typeof window !== "undefined" && window.innerHeight - anchor.bottom < POPUP_HEIGHT && anchor.top > POPUP_HEIGHT;
  const typed = state.filter.trim();

  let empty: string | null = null;
  if (options.length === 0) empty = typed ? t("grid.invalid", { value: typed }) : t("picker.none", { locus: state.locus });
  else if (!hasTable && !typed) empty = t("picker.none", { locus: state.locus });

  return (
    <div
      ref={ref}
      style={{
        left: Math.max(8, Math.min(anchor.left, (typeof window === "undefined" ? 9999 : window.innerWidth) - 200)),
        ...(above ? { bottom: window.innerHeight - anchor.top + 4 } : { top: anchor.bottom + 4 }),
      }}
      className="fixed z-50 w-48 overflow-hidden rounded-md border border-line-strong bg-surface shadow-lg shadow-ink/10 print:hidden"
    >
      {empty && <p className="px-3 py-2 text-xs leading-snug text-muted">{empty}</p>}
      <ul id={listId} role="listbox" aria-label={state.locus} className="max-h-60 overflow-y-auto py-1 text-sm">
        {options.map((option, index) => (
          <li
            key={option.kind === "other" ? "other" : `${option.kind}-${option.value}`}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === state.highlight}
            // Keep focus in the cell: the list is driven from there.
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => onHover(index)}
            onClick={() => onChoose(option)}
            className={cn(
              "flex cursor-pointer items-baseline justify-between gap-3 px-3 py-1",
              index === state.highlight ? "bg-sunken text-ink" : "text-text",
              option.kind !== "allele" && "mt-1 border-t border-line pt-1.5",
            )}
          >
            {option.kind === "allele" && (
              <>
                <span className="font-medium">{option.value}</span>
                {option.frequency !== undefined && (
                  <span className="text-xs text-muted">{formatFrequency(option.frequency, locale)}</span>
                )}
              </>
            )}
            {option.kind === "custom" && (
              <>
                <span className="font-medium">{t("picker.custom", { allele: option.value })}</span>
                <span className="text-xs text-attention">{t("picker.custom.hint")}</span>
              </>
            )}
            {option.kind === "other" && <span>{t("picker.other")}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
