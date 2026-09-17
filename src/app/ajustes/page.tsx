"use client";

import { useState } from "react";
import { Button, cn, Field, Panel, TextArea, TextInput } from "@/components/ui";
import {
  AABB_MUTATION_RATES,
  DEFAULT_MUTATION_RATES,
  formatRate,
  LOCI,
  type MutationRates,
} from "@/lib/genetics";
import { useLocale, useT } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";

export default function SettingsPage() {
  const t = useT();
  const settings = useAppStore((state) => state.settings);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const updateLab = useAppStore((state) => state.updateLab);
  const reset = useAppStore((state) => state.resetCalculationSettings);
  // Remounting the number fields is the simplest way to show the restored values.
  const [resetCount, setResetCount] = useState(0);

  const { decision, minFrequency, mutationModel, lab } = settings;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <h1 className="font-serif text-3xl font-semibold text-ink">{t("settings.title")}</h1>

      <Panel
        key={resetCount}
        title={t("settings.calculation")}
        aside={
          <Button
            onClick={() => {
              reset();
              setResetCount((count) => count + 1);
            }}
          >
            {t("settings.reset")}
          </Button>
        }
      >
        <div className="grid gap-x-6 gap-y-5 p-4 sm:grid-cols-2">
          <NumberField
            label={t("settings.threshold")}
            hint={t("settings.threshold.hint")}
            value={Number((decision.inclusionThreshold * 100).toPrecision(10))}
            valid={(value) => value >= 50 && value < 100}
            onCommit={(value) => updateSettings({ decision: { ...decision, inclusionThreshold: value / 100 } })}
          />
          <NumberField
            label={t("settings.exclusion")}
            hint={t("settings.exclusion.hint")}
            value={decision.exclusionInconsistencies}
            valid={(value) => Number.isInteger(value) && value >= 2 && value <= 6}
            onCommit={(value) => updateSettings({ decision: { ...decision, exclusionInconsistencies: value } })}
          />
          <NumberField
            label={t("settings.prior")}
            hint={t("settings.prior.hint")}
            value={decision.prior}
            valid={(value) => value > 0 && value < 1}
            onCommit={(value) => updateSettings({ decision: { ...decision, prior: value } })}
          />
          <NumberField
            label={t("settings.decimals")}
            value={settings.probabilityDecimals}
            valid={(value) => Number.isInteger(value) && value >= 2 && value <= 10}
            onCommit={(value) => updateSettings({ probabilityDecimals: value })}
          />

          <Choice
            legend={t("settings.minFrequency")}
            hint={t("settings.minFrequency.hint")}
            value={minFrequency.kind}
            options={[
              { value: "fiveOver2N", label: t("settings.minFrequency.fiveOver2N") },
              { value: "fixed", label: t("settings.minFrequency.fixed") },
            ]}
            onChange={(kind) => updateSettings({ minFrequency: { ...minFrequency, kind } })}
          />
          <NumberField
            label={t("settings.minFrequency.fixedValue")}
            value={minFrequency.fixed}
            valid={(value) => value > 0 && value <= 0.2}
            onCommit={(value) => updateSettings({ minFrequency: { ...minFrequency, fixed: value } })}
          />

          <Choice
            legend={t("settings.mutation")}
            value={mutationModel.kind}
            options={[
              { value: "stepwise", label: t("settings.mutation.stepwise") },
              { value: "aabb", label: t("settings.mutation.aabb") },
            ]}
            onChange={(kind) => updateSettings({ mutationModel: { ...mutationModel, kind } })}
          />
          <div className="flex flex-col gap-5">
            <NumberField
              label={t("settings.mutation.range")}
              hint={t("settings.mutation.range.hint")}
              value={mutationModel.range}
              valid={(value) => value > 0 && value < 1}
              onCommit={(value) => updateSettings({ mutationModel: { ...mutationModel, range: value } })}
            />
            <NumberField
              label={t("settings.mutation.fractional")}
              value={mutationModel.fractionalRate}
              valid={(value) => value >= 0 && value <= 0.001}
              onCommit={(value) => updateSettings({ mutationModel: { ...mutationModel, fractionalRate: value } })}
            />
          </div>
        </div>

        <div className="border-t border-line p-4">
          <h3 className="text-sm font-semibold text-ink">{t("settings.mutation.rates")}</h3>
          <p className="mt-1 mb-3 max-w-3xl text-sm leading-snug text-muted">{t("settings.mutation.rates.hint")}</p>
          <MutationRatesTable />
        </div>
      </Panel>

      <Panel title={t("settings.lab")}>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label={t("settings.lab.name")}>
            {(props) => <TextInput {...props} value={lab.name} onChange={(event) => updateLab({ name: event.target.value })} />}
          </Field>
          <Field label={t("settings.lab.contact")}>
            {(props) => <TextInput {...props} value={lab.contact} onChange={(event) => updateLab({ contact: event.target.value })} />}
          </Field>
          <Field label={t("settings.lab.signerName")}>
            {(props) => (
              <TextInput {...props} value={lab.signerName} onChange={(event) => updateLab({ signerName: event.target.value })} />
            )}
          </Field>
          <Field label={t("settings.lab.signerTitle")}>
            {(props) => (
              <TextInput {...props} value={lab.signerTitle} onChange={(event) => updateLab({ signerTitle: event.target.value })} />
            )}
          </Field>
          <Field label={t("settings.lab.instrument")} hint={t("settings.lab.hint")} className="sm:col-span-2">
            {(props) => (
              <TextArea {...props} rows={2} value={lab.instrument} onChange={(event) => updateLab({ instrument: event.target.value })} />
            )}
          </Field>
        </div>
      </Panel>
    </div>
  );
}

/** Keeps what is being typed until it is a valid number, then commits it. */
function NumberField({
  label,
  hint,
  value,
  valid,
  onCommit,
}: {
  label: string;
  hint?: string;
  value: number;
  valid: (value: number) => boolean;
  onCommit: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));
  const parsed = Number(text.replace(",", "."));
  const ok = text.trim() !== "" && Number.isFinite(parsed) && valid(parsed);

  return (
    <Field label={label} hint={hint}>
      {(props) => (
        <TextInput
          {...props}
          inputMode="decimal"
          value={text}
          aria-invalid={!ok || undefined}
          onChange={(event) => {
            setText(event.target.value);
            const next = Number(event.target.value.replace(",", "."));
            if (event.target.value.trim() !== "" && Number.isFinite(next) && valid(next)) onCommit(next);
          }}
          onBlur={() => !ok && setText(String(value))}
          className={cn("w-40", !ok && "border-invalid bg-invalid-soft")}
        />
      )}
    </Field>
  );
}

function Choice<T extends string>({
  legend,
  hint,
  value,
  options,
  onChange,
}: {
  legend: string;
  hint?: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium text-text">{legend}</legend>
      {options.map((option) => (
        <label key={option.value} className="flex cursor-pointer items-start gap-2 text-sm text-text">
          <input
            type="radio"
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="mt-0.5 size-4 accent-ink"
          />
          {option.label}
        </label>
      ))}
      {hint && <p className="text-xs leading-snug text-muted">{hint}</p>}
    </fieldset>
  );
}

function MutationRatesTable() {
  const t = useT();
  const locale = useLocale();
  const overrides = useAppStore((state) => state.settings.mutationOverrides);
  const updateSettings = useAppStore((state) => state.updateSettings);

  const commit = (locus: string, which: keyof MutationRates, raw: string) => {
    const base = AABB_MUTATION_RATES[locus] ?? DEFAULT_MUTATION_RATES;
    const current = overrides[locus] ?? base;
    const value = Number(raw.replace(",", "."));
    const next = { ...current, [which]: raw.trim() !== "" && value >= 0 && value < 0.1 ? value : base[which] };
    const rest = { ...overrides };
    delete rest[locus];
    const unchanged = next.paternal === base.paternal && next.maternal === base.maternal;
    updateSettings({ mutationOverrides: unchanged ? rest : { ...rest, [locus]: next } });
  };

  return (
    <div className="grid gap-x-8 sm:grid-cols-2">
      {[0, 1].map((half) => {
        const loci = Object.keys(LOCI).filter((_, index) => index % 2 === half);
        return (
          <table key={half} className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="py-1.5 font-medium">{t("grid.marker")}</th>
                <th className="py-1.5 font-medium">{t("settings.mutation.paternal")}</th>
                <th className="py-1.5 font-medium">{t("settings.mutation.maternal")}</th>
              </tr>
            </thead>
            <tbody>
              {loci.map((locus) => {
                const base = AABB_MUTATION_RATES[locus];
                return (
                  <tr key={locus} className="border-b border-line/60">
                    <th scope="row" className="py-1 pr-2 text-left font-medium whitespace-nowrap text-ink">
                      {locus}
                      {!base && <span className="ml-1.5 text-xs font-normal text-faint">{t("settings.mutation.default")}</span>}
                    </th>
                    {(["paternal", "maternal"] as const).map((which) => (
                      <td key={which} className="py-1 pr-2">
                        <input
                          key={`${locus}-${which}-${overrides[locus]?.[which] ?? "default"}`}
                          defaultValue={overrides[locus]?.[which] ?? ""}
                          placeholder={formatRate((base ?? DEFAULT_MUTATION_RATES)[which], locale)}
                          inputMode="decimal"
                          aria-label={`${locus} ${t(`settings.mutation.${which}`)}`}
                          onBlur={(event) => commit(locus, which, event.target.value)}
                          className="h-7 w-24 rounded border border-line-strong bg-surface px-1.5 text-ink placeholder:text-muted hover:border-muted"
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        );
      })}
    </div>
  );
}
