"use client";

import { useState } from "react";
import { compareAlleles, formatFrequency, parseAllele, type Population } from "@/lib/genetics";
import { useLocale, useT } from "@/lib/i18n";
import { Button, cn, TextInput } from "./ui";

/** Alleles down, markers across: the layout laboratories already keep these tables in. */
export function FrequencyTable({
  population,
  onChange,
}: {
  population: Population;
  /** When given, cells become editable and every change is reported upwards. */
  onChange?: (population: Population) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const [newAllele, setNewAllele] = useState("");
  const [extraAlleles, setExtraAlleles] = useState<string[]>([]);

  const loci = Object.keys(population.loci);
  const alleles = [
    ...new Set([...loci.flatMap((locus) => Object.keys(population.loci[locus].freqs)), ...extraAlleles]),
  ].sort(compareAlleles);
  const editable = Boolean(onChange);

  const setFrequency = (locus: string, allele: string, raw: string) => {
    const freqs = { ...population.loci[locus].freqs };
    const value = Number(raw.replace(",", "."));
    if (raw.trim() === "" || !Number.isFinite(value) || value <= 0) delete freqs[allele];
    else freqs[allele] = Math.min(value, 1);
    onChange?.({ ...population, loci: { ...population.loci, [locus]: { ...population.loci[locus], freqs } } });
  };

  const setChromosomes = (locus: string, raw: string) => {
    const value = Math.round(Number(raw));
    onChange?.({
      ...population,
      loci: {
        ...population.loci,
        [locus]: { ...population.loci[locus], chromosomes: value > 0 ? value : undefined },
      },
    });
  };

  const addAllele = () => {
    const parsed = parseAllele(newAllele);
    if (parsed.ok && !alleles.includes(parsed.allele)) setExtraAlleles((current) => [...current, parsed.allele]);
    setNewAllele("");
  };

  const headCell = "sticky top-0 z-10 border-b border-line-strong bg-sunken px-2 py-1.5 font-semibold whitespace-nowrap";

  return (
    <div className="flex flex-col gap-3">
      <div className="relative max-h-[70vh] overflow-auto rounded-md border border-line">
        <table className="min-w-full border-separate border-spacing-0 text-right text-[0.8125rem]">
          <thead>
            <tr>
              <th scope="col" className={cn(headCell, "left-0 z-20 text-left")}>
                {t("pop.allele")}
              </th>
              {loci.map((locus) => (
                <th key={locus} scope="col" className={headCell}>
                  {locus}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {alleles.map((allele) => (
              <tr key={allele} className="hover:bg-sunken/60">
                <th scope="row" className="sticky left-0 border-b border-line bg-surface px-2 py-1 text-left font-semibold">
                  {allele}
                </th>
                {loci.map((locus) => {
                  const value = population.loci[locus].freqs[allele];
                  return (
                    <td key={locus} className="border-b border-line px-1 py-0.5">
                      {editable ? (
                        <input
                          defaultValue={value ?? ""}
                          inputMode="decimal"
                          aria-label={`${locus} ${allele}`}
                          onBlur={(event) => setFrequency(locus, allele, event.target.value)}
                          className="h-7 w-16 rounded border border-line bg-surface px-1 text-right text-ink hover:border-muted"
                        />
                      ) : value === undefined ? (
                        <span className="px-1 text-line-strong">·</span>
                      ) : (
                        <span className="px-1 text-ink">{formatFrequency(value, locale)}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="sticky bottom-7 left-0 z-10 border-t border-line-strong bg-sunken px-2 py-1 text-left font-semibold whitespace-nowrap">
                {t("pop.sum")}
              </th>
              {loci.map((locus) => {
                const sum = Object.values(population.loci[locus].freqs).reduce((total, value) => total + value, 0);
                return (
                  <td
                    key={locus}
                    className={cn(
                      "sticky bottom-7 border-t border-line-strong bg-sunken px-2 py-1",
                      Math.abs(sum - 1) > 0.02 ? "font-semibold text-attention" : "text-muted",
                    )}
                  >
                    {sum.toFixed(3)}
                  </td>
                );
              })}
            </tr>
            <tr>
              <th scope="row" className="sticky bottom-0 left-0 z-10 h-7 bg-sunken px-2 py-1 text-left font-semibold whitespace-nowrap">
                {t("pop.chromosomes")}
              </th>
              {loci.map((locus) => (
                <td key={locus} className="sticky bottom-0 h-7 bg-sunken px-1 py-0.5 text-muted">
                  {editable ? (
                    <input
                      defaultValue={population.loci[locus].chromosomes ?? ""}
                      inputMode="numeric"
                      aria-label={`${locus} ${t("pop.chromosomes")}`}
                      onBlur={(event) => setChromosomes(locus, event.target.value)}
                      className="h-6 w-16 rounded border border-line bg-surface px-1 text-right text-ink hover:border-muted"
                    />
                  ) : (
                    <span className="px-1">{population.loci[locus].chromosomes ?? "—"}</span>
                  )}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          <TextInput
            value={newAllele}
            onChange={(event) => setNewAllele(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && addAllele()}
            placeholder={t("pop.addAllele.placeholder")}
            aria-label={t("pop.addAllele")}
            className="w-32"
          />
          <Button onClick={addAllele}>{t("pop.addAllele")}</Button>
          <p className="text-sm text-muted">{t("pop.edit.hint")}</p>
        </div>
      )}
    </div>
  );
}
