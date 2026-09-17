"use client";

import { useMemo } from "react";
import type { Locale, ParentSex } from "@/lib/genetics";
import { useAppStore, type SubjectRole } from "@/lib/store";
import { en } from "./en";
import { es, type MessageKey } from "./es";

export type { MessageKey };

const MESSAGES: Record<Locale, Record<MessageKey, string>> = { es, en };

export type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

export function translate(locale: Locale): Translate {
  return (key, values) => {
    const template = MESSAGES[locale][key] ?? key;
    if (!values) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in values ? String(values[name]) : match,
    );
  };
}

export function useLocale(): Locale {
  return useAppStore((state) => state.settings.locale);
}

export function useT(): Translate {
  const locale = useLocale();
  return useMemo(() => translate(locale), [locale]);
}

/** Message families that come as "<base>.one" and "<base>.other". */
export type PluralBase = {
  [K in MessageKey]: K extends `${infer Base}.one` ? Base : never;
}[MessageKey];

export function plural(
  t: Translate,
  base: PluralBase,
  n: number,
  values: Record<string, string | number> = {},
): string {
  return t(`${base}.${n === 1 ? "one" : "other"}` as MessageKey, { n, ...values });
}

/** "Madre biológica" / "Presunto padre"... depends on whose parentage is in question. */
export function roleLabel(t: Translate, role: SubjectRole, allegedSex: ParentSex): string {
  if (role === "child") return t("role.child");
  return t(`role.${role}.${allegedSex}` as MessageKey);
}

/** The role as it reads inside a sentence: "el presunto padre", "the alleged father". */
export function rolePhrase(t: Translate, role: SubjectRole, allegedSex: ParentSex): string {
  if (role === "child") return t("role.phrase.child");
  return t(`role.phrase.${role}.${allegedSex}` as MessageKey);
}

export function roleCode(t: Translate, role: SubjectRole, allegedSex: ParentSex): string {
  if (role === "child") return t("role.code.child");
  return t(`role.code.${role}.${allegedSex}` as MessageKey);
}
