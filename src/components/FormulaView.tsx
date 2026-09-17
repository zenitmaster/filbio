import type { Allele, Formula } from "@/lib/genetics";

/** p with the allele as a subscript, set as in a journal: italic variable, upright index. */
function P({ allele }: { allele: Allele }) {
  return (
    <>
      <i>p</i>
      <sub className="text-[0.7em] not-italic">{allele}</sub>
    </>
  );
}

/** The closed form of a per-locus index: 1 / 2p₁₅, 1 / (p₁₀ + p₁₁), (p₇ + p₉) / 4p₇p₉. */
export function FormulaView({ formula }: { formula: Formula }) {
  switch (formula.kind) {
    case "oneOverP":
      return (
        <span className="math">
          1 / {formula.k > 1 && formula.k}
          <P allele={formula.allele} />
        </span>
      );
    case "oneOverSum":
      return (
        <span className="math">
          1 / {formula.k > 1 && formula.k}(<P allele={formula.alleles[0]} /> +{" "}
          <P allele={formula.alleles[1]} />)
        </span>
      );
    case "sumOverProduct":
      return (
        <span className="math">
          (<P allele={formula.alleles[0]} /> + <P allele={formula.alleles[1]} />) / 4
          <P allele={formula.alleles[0]} />
          <P allele={formula.alleles[1]} />
        </span>
      );
  }
}

/** Plain-text version for places that cannot render markup (aria labels, exports). */
export function formulaToText(formula: Formula): string {
  const p = (allele: Allele) => `p(${allele})`;
  switch (formula.kind) {
    case "oneOverP":
      return `1 / ${formula.k > 1 ? formula.k : ""}${p(formula.allele)}`;
    case "oneOverSum":
      return `1 / ${formula.k > 1 ? formula.k : ""}(${p(formula.alleles[0])} + ${p(formula.alleles[1])})`;
    case "sumOverProduct":
      return `(${p(formula.alleles[0])} + ${p(formula.alleles[1])}) / 4${p(formula.alleles[0])}${p(formula.alleles[1])}`;
  }
}
