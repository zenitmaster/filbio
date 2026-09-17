import {
  formatFrequency,
  formatGrouped,
  formatProbabilityPercent,
  minimumFrequency,
  probabilityToString,
  scientificToString,
  toScientific,
  type Locale,
} from "@/lib/genetics";
import type { CaseData, Settings, SubjectRole } from "@/lib/store";
import type { CaseView } from "@/lib/store/useCaseResult";

export interface ReportText {
  basis: string;
  description: string;
  method: string[];
  resultsIntro: string;
  considerations: Array<{ title: string; body: string }>;
  conclusion: string[];
  cpi: string;
  probability: string;
}

const INTL: Record<Locale, string> = { es: "es-MX", en: "en-US" };

export function formatDate(iso: string, locale: Locale): string {
  if (!iso) return "";
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  // Built from parts so the date is not shifted by the viewer's time zone.
  return new Intl.DateTimeFormat(INTL[locale], { dateStyle: "long" }).format(new Date(year, month - 1, day));
}

export function todayIso(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Spanish contracts "de el" to "del": "del presunto padre", but "de la presunta madre". */
function de(phrase: string): string {
  return phrase.startsWith("el ") ? `del ${phrase.slice(3)}` : `de ${phrase}`;
}

function trim(value: number): string {
  return String(Number(value.toPrecision(10)));
}

export interface RoleWording {
  /** "el presunto padre": how the role reads inside a sentence. */
  phrase: string;
  /** "PP": prefix of the internal sample code. */
  code: string;
}

export function buildReport(
  view: CaseView,
  caseData: CaseData,
  settings: Settings,
  locale: Locale,
  wording: Record<SubjectRole, RoleWording>,
): ReportText {
  const { result, kit, loci, population } = view;
  const es = locale === "es";
  const paternity = caseData.allegedSex === "male";
  const trio = caseData.mode === "trio";

  // In running text a person is their name, or failing that their role.
  const who = (role: SubjectRole) => caseData.subjects[role].name.trim() || wording[role].phrase;
  // A sample is identified by name, else by its internal code, else by role.
  const sample = (role: SubjectRole) =>
    caseData.subjects[role].name.trim() ||
    (caseData.caseId ? `${wording[role].code}-${caseData.caseId}` : wording[role].phrase);
  const child = sample("child");
  const alleged = sample("alleged");
  const allegedPerson = who("alleged");

  const bond = es ? (paternity ? "paternidad" : "maternidad") : paternity ? "paternity" : "maternity";
  const parent = es ? (paternity ? "padre" : "madre") : paternity ? "father" : "mother";
  const markers = loci.length;
  const received = formatDate(caseData.receivedOn, locale);
  const threshold = trim(settings.decision.inclusionThreshold * 100);
  const limit = settings.decision.exclusionInconsistencies;

  const cpi =
    result.cpi >= 1e7 || (result.cpi > 0 && result.cpi < 1e-3)
      ? scientificToString(toScientific(result.cpi, 3))
      : formatGrouped(result.cpi, locale);
  const probability = probabilityToString(
    formatProbabilityPercent(result.posteriorComplement, settings.probabilityDecimals),
  );

  const sampleLocus = Object.values(population.loci)[0];
  const minimum = sampleLocus ? minimumFrequency(sampleLocus, settings.minFrequency) : settings.minFrequency.fixed;
  const minimumRule =
    settings.minFrequency.kind === "fiveOver2N"
      ? `5/(2N) = ${formatFrequency(minimum, locale)}`
      : formatFrequency(minimum, locale);

  const consistent = result.computedCount - result.allegedInconsistencies.length;
  const inconsistent = result.allegedInconsistencies;

  // --- fixed paragraphs ---------------------------------------------------

  const basis = es
    ? "Las leyes de la herencia determinan que un individuo recibe la mitad de su material genético de la madre, a través del óvulo, y la otra mitad del padre, a través del espermatozoide. Ese material es el ADN. En él existen regiones muy variables entre personas (polimorfismos genéticos) que permiten distinguir la variante aportada por la madre de la aportada por el padre. Con la metodología que se describe a continuación es posible excluir un vínculo biológico o, de no excluirse, estimar la probabilidad de que exista."
    : "The laws of inheritance determine that a person receives half of their genetic material from the mother, through the egg, and half from the father, through the sperm. That material is DNA. It contains regions that vary greatly between people (genetic polymorphisms), which make it possible to tell the variant contributed by the mother from the one contributed by the father. With the methodology described below, a biological relationship can be excluded or, if it is not excluded, the probability that it exists can be estimated.";

  const description = es
    ? `${received ? `El día ${received} se recibieron` : "Se recibieron"} en este laboratorio las muestras biológicas de las personas involucradas. De las muestras se extrajo el ADN y se analizaron ${markers} marcadores genéticos de tipo STR, regiones del genoma altamente polimórficas, con la finalidad de determinar si existe concordancia entre las variantes (alelos) de las personas estudiadas. Además se analizó el marcador de amelogenina (AMEL) para la determinación del sexo.`
    : `${received ? `On ${received} the` : "The"} biological samples of the people involved were received at this laboratory. DNA was extracted from the samples and ${markers} STR genetic markers, highly polymorphic regions of the genome, were analysed in order to determine whether the variants (alleles) of the people studied are consistent. The amelogenin marker (AMEL) was also analysed for sex determination.`;

  const mutationModel =
    settings.mutationModel.kind === "stepwise"
      ? es
        ? `un modelo de mutación escalonado (cada paso de repetición adicional ${trim(1 / settings.mutationModel.range)} veces menos probable)`
        : `a stepwise mutation model (each additional repeat step ${trim(1 / settings.mutationModel.range)} times less likely)`
      : es
        ? "la fórmula de la AABB (tasa de mutación entre el poder de exclusión medio del marcador)"
        : "the AABB formula (mutation rate over the marker's mean power of exclusion)";

  const method = es
    ? [
        `A partir del ADN extraído de las muestras se amplificaron, mediante reacción en cadena de la polimerasa (PCR) con el estuche ${kit.name}, los marcadores: ${loci.join(", ")} y amelogenina.${settings.lab.instrument ? ` ${settings.lab.instrument}` : ""}`,
        `El índice de ${bond} de cada marcador es el cociente entre la probabilidad de observar el perfil del hijo(a) si ${allegedPerson} es ${parent === "padre" ? "el padre biológico" : "la madre biológica"} y la probabilidad de observarlo si lo es una persona al azar de la población${trio ? ", considerando el perfil del progenitor conocido" : ""}. El índice combinado es el producto de los índices, y la probabilidad de ${bond} (W) se obtiene con una probabilidad a priori de ${trim(settings.decision.prior)}.`,
        `Frecuencias alélicas: ${population.name.es}. ${population.source.citation} Frecuencia alélica mínima: ${minimumRule}. Las discordancias aisladas se evaluaron con ${mutationModel} y las tasas de mutación de la AABB tabuladas por NIST STRBase.`,
      ]
    : [
        `From the DNA extracted from the samples, the following markers were amplified by polymerase chain reaction (PCR) with the ${kit.name} kit: ${loci.join(", ")} and amelogenin.${settings.lab.instrument ? ` ${settings.lab.instrument}` : ""}`,
        `The ${bond} index of each marker is the ratio between the probability of observing the child's profile if ${allegedPerson} is the biological ${parent} and the probability of observing it if a random person from the population is${trio ? ", given the profile of the known parent" : ""}. The combined index is the product of the indices, and the probability of ${bond} (W) is obtained with a prior probability of ${trim(settings.decision.prior)}.`,
        `Allele frequencies: ${population.name.en}. ${population.source.citation} Minimum allele frequency: ${minimumRule}. Isolated inconsistencies were evaluated with ${mutationModel} and the AABB mutation rates tabulated by NIST STRBase.`,
      ];

  const resultsIntro = es
    ? `La tabla enlista los alelos obtenidos en cada persona. En negritas, los alelos del hijo(a) presentes en ${allegedPerson}; se señalan los marcadores en que no existe concordancia.`
    : `The table lists the alleles obtained for each person. In bold, the child's alleles that are present in ${allegedPerson}; markers with no concordance are flagged.`;

  const considerations = es
    ? [
        {
          title: "Sin discordancias",
          body: `Cuando no existen discordancias se calculan, con las frecuencias alélicas de la población de referencia, el índice de ${bond} y la probabilidad de ${bond} (W). El vínculo se considera prácticamente probado cuando W alcanza ${threshold} %; por debajo de ese valor el resultado es no concluyente y se recomienda ampliar el número de marcadores.`,
        },
        {
          title: `Una a ${limit - 1} discordancias`,
          body: "Se considera la posibilidad de que se hayan producido mutaciones y el índice de esos marcadores se calcula con las tasas de mutación correspondientes. Se recomienda confirmar con marcadores adicionales.",
        },
        {
          title: `${limit} o más discordancias`,
          body: `Se excluye la ${bond} biológica.`,
        },
      ]
    : [
        {
          title: "No inconsistencies",
          body: `When there are no inconsistencies, the ${bond} index and the probability of ${bond} (W) are calculated with the allele frequencies of the reference population. The relationship is considered practically proven when W reaches ${threshold} %; below that value the result is inconclusive and typing more markers is recommended.`,
        },
        {
          title: `One to ${limit - 1} inconsistencies`,
          body: "The possibility of mutation is considered and the index of those markers is calculated with the corresponding mutation rates. Confirmation with additional markers is recommended.",
        },
        {
          title: `${limit} or more inconsistencies`,
          body: `Biological ${bond} is excluded.`,
        },
      ];

  // --- conclusion ---------------------------------------------------------

  const conclusion: string[] = [];
  const compared = es
    ? `La comparación de la muestra identificada como ${child} con la identificada como ${alleged}`
    : `The comparison of the sample identified as ${child} with the one identified as ${alleged}`;

  if (result.verdict === "exclusion") {
    conclusion.push(
      es
        ? `${compared} muestra discordancia en ${inconsistent.length} de los ${result.computedCount} marcadores analizados (${inconsistent.join(", ")}). Estos resultados excluyen la ${bond} biológica ${de(allegedPerson)} respecto ${de(who("child"))}.`
        : `${compared} shows inconsistencies at ${inconsistent.length} of the ${result.computedCount} markers analysed (${inconsistent.join(", ")}). These results exclude the biological ${bond} of ${allegedPerson} with respect to ${who("child")}.`,
    );
  } else {
    conclusion.push(
      es
        ? `${compared} muestra concordancia alélica en ${consistent} de los ${result.computedCount} marcadores analizados.`
        : `${compared} shows allelic concordance at ${consistent} of the ${result.computedCount} markers analysed.`,
    );
    if (inconsistent.length > 0) {
      conclusion.push(
        es
          ? `La discordancia observada en ${inconsistent.join(", ")} es compatible con una mutación y así se consideró en el cálculo.`
          : `The inconsistency observed at ${inconsistent.join(", ")} is compatible with a mutation and was treated as such in the calculation.`,
      );
    }
    conclusion.push(
      result.verdict === "inclusion"
        ? es
          ? `Estos resultados no excluyen la ${bond} biológica y son compatibles con ella, con un índice combinado de ${bond} de ${cpi} y una probabilidad de ${bond} de ${probability}.`
          : `These results do not exclude biological ${bond} and are consistent with it, with a combined ${bond} index of ${cpi} and a probability of ${bond} of ${probability}.`
        : es
          ? `Estos resultados no excluyen la ${bond} biológica, pero la probabilidad obtenida (${probability}, índice combinado de ${cpi}) no alcanza el umbral de ${threshold} % del laboratorio. El resultado es no concluyente; se recomienda ampliar el número de marcadores.`
          : `These results do not exclude biological ${bond}, but the probability obtained (${probability}, combined index ${cpi}) does not reach the laboratory's ${threshold} % threshold. The result is inconclusive; typing more markers is recommended.`,
    );
  }
  if (result.knownInconsistencies.length > 0) {
    conclusion.push(
      es
        ? `Advertencia: ${who("known")} no comparte alelo con ${who("child")} en ${result.knownInconsistencies.join(", ")}. Debe verificarse la identidad de las muestras antes de emitir este informe.`
        : `Warning: ${who("known")} shares no allele with ${who("child")} at ${result.knownInconsistencies.join(", ")}. The identity of the samples must be checked before this report is issued.`,
    );
  }

  return { basis, description, method, resultsIntro, considerations, conclusion, cpi, probability };
}
