/**
 * Number formatting for indices and probabilities.
 *
 * A probability of parentage is never reported as 100 %: the value is
 * truncated, not rounded, and once it exceeds what the chosen decimals can show
 * it is given as a lower bound ("> 99.999999 %").
 */

export type Locale = "es" | "en";

// Mexico writes the decimal point, unlike Spain.
const INTL_LOCALE: Record<Locale, string> = { es: "es-MX", en: "en-US" };

export interface ProbabilityText {
  /** Percentage without the sign, e.g. "99.999871". */
  value: string;
  /** "" when exact, ">" or "<" when the value is only a bound. */
  bound: "" | ">" | "<";
}

/**
 * @param complement 1 - W, which stays accurate when W is within 1e-16 of 1.
 */
export function formatProbabilityPercent(complement: number, decimals = 6): ProbabilityText {
  const unit = 10 ** -decimals;
  const percent = 100 * (1 - complement);
  const complementPercent = 100 * complement;

  if (complementPercent < unit) return { value: (100 - unit).toFixed(decimals), bound: ">" };
  if (percent < unit) return { value: unit.toFixed(decimals), bound: "<" };

  // The epsilon undoes binary representation error (99.99 * 1e6 = 99989999.99999999).
  const truncated = Math.floor(percent / unit + 1e-6) * unit;
  return { value: truncated.toFixed(decimals), bound: "" };
}

export function probabilityToString(text: ProbabilityText): string {
  return `${text.bound ? `${text.bound} ` : ""}${text.value} %`;
}

/** A per-locus index to four significant figures: 3.509, 0.005614, 1000. */
export function formatIndex(value: number, locale: Locale = "es"): string {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  if (value >= 1e7 || value < 1e-4) return scientificToString(toScientific(value, 3));
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    maximumSignificantDigits: 4,
    useGrouping: value >= 10000,
  }).format(value);
}

export interface Scientific {
  mantissa: string;
  exponent: number;
}

export function toScientific(value: number, digits = 3): Scientific {
  if (value === 0 || !Number.isFinite(value)) return { mantissa: "0", exponent: 0 };
  let exponent = Math.floor(Math.log10(Math.abs(value)));
  let mantissa = value / 10 ** exponent;
  // 9.9996 rounds to 10.00 at three decimals; carry it into the exponent.
  if (Number(mantissa.toFixed(digits - 1)) >= 10) {
    mantissa /= 10;
    exponent += 1;
  }
  return { mantissa: mantissa.toFixed(digits - 1), exponent };
}

const SUPERSCRIPT: Record<string, string> = {
  "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
};

export function scientificToString({ mantissa, exponent }: Scientific): string {
  const power = [...String(exponent)].map((char) => SUPERSCRIPT[char] ?? char).join("");
  return `${mantissa} × 10${power}`;
}

/** The combined index written out in full, grouped: 7,875,797,024,646. */
export function formatGrouped(value: number, locale: Locale = "es"): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    maximumFractionDigits: value >= 100 ? 0 : 4,
  }).format(value);
}

/** An allele frequency as tabulated: 0.285, 0.0037. */
export function formatFrequency(value: number, locale: Locale = "es"): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    minimumFractionDigits: 3,
    maximumFractionDigits: 4,
  }).format(value);
}

export function formatRate(value: number, locale: Locale = "es"): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], { maximumSignificantDigits: 3 }).format(value);
}
