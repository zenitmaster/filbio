"use client";

import type { ReactNode } from "react";
import { useLocale } from "@/lib/i18n";

/** p with a subscript, as set in the results grid. */
function P({ s }: { s: string }) {
  return (
    <>
      <i>p</i>
      <sub className="text-[0.7em] not-italic">{s}</sub>
    </>
  );
}
const M = ({ children }: { children: ReactNode }) => <span className="math">{children}</span>;

type Row = [known: string, child: string, alleged: string, formula: ReactNode];

// A, B, C stand for any distinct alleles; the mother's other allele never matters.
const TRIO: Row[] = [
  ["AA o AB", "AA", "AA", <>1 / <P s="A" /></>],
  ["AA o AB", "AA", "AB", <>1 / 2<P s="A" /></>],
  ["AA o AC", "AB", "BB", <>1 / <P s="B" /></>],
  ["AA o AC", "AB", "AB o BC", <>1 / 2<P s="B" /></>],
  ["AB", "AB", "AA, BB o AB", <>1 / (<P s="A" /> + <P s="B" />)</>],
  ["AB", "AB", "AC o BC", <>1 / 2(<P s="A" /> + <P s="B" />)</>],
];
const DUO: Array<[child: string, alleged: string, formula: ReactNode]> = [
  ["AA", "AA", <>1 / <P s="A" /></>],
  ["AA", "AB", <>1 / 2<P s="A" /></>],
  ["AB", "AA", <>1 / 2<P s="A" /></>],
  ["AB", "AB", <>(<P s="A" /> + <P s="B" />) / 4<P s="A" /><P s="B" /></>],
  ["AB", "AC", <>1 / 4<P s="A" /></>],
];

const REFERENCES = [
  "Gjertson DW, Brenner CH, Baur MP, et al. ISFG: Recommendations on biostatistics in paternity testing. Forensic Sci Int Genet 2007;1:223-231.",
  "National Research Council. The Evaluation of Forensic DNA Evidence. Washington, DC: National Academy Press; 1996.",
  "Brenner CH. Mutations in paternity. dna-view.com/mudisc.htm",
  "AABB. Annual Report Summary for Testing in 2003; mutation rates as tabulated by NIST STRBase.",
  "Essen-Möller E. Die Beweiskraft der Ähnlichkeit im Vaterschaftsnachweis. Mitt Anthropol Ges Wien 1938;68:9-53.",
  "Ohno Y, Sebetan IM, Akaishi S. A simple method for calculating the probability of excluding paternity with any number of codominant alleles. Forensic Sci Int 1982;19:93-98.",
  "Butler JM. Advanced Topics in Forensic DNA Typing: Interpretation. San Diego: Academic Press; 2015.",
  "Hill CR, Duewer DL, Kline MC, Coble MD, Butler JM. U.S. population data for 29 autosomal STR loci. Forensic Sci Int Genet 2013;7:e82-e83; Steffen CR, et al. Corrigendum. 2017;31:e36-e40.",
  "Moretti TR, Moreno LI, Smerick JB, et al. Population data on the expanded CODIS core STR loci for eleven populations of significance for forensic DNA analyses in the United States. Forensic Sci Int Genet 2016;25:175-181.",
];

export default function MethodPage() {
  const es = useLocale() === "es";
  const or = (text: string) => (es ? text : text.replaceAll(" o ", " or "));

  return (
    <article className="mx-auto max-w-3xl pb-10 text-[1.02rem] leading-relaxed text-text">
      <h1 className="font-serif text-3xl font-semibold text-ink">{es ? "Método" : "Method"}</h1>
      <p className="mt-3">
        {es
          ? "Todo lo que FilBio calcula está descrito aquí, para que cualquier laboratorio pueda reproducirlo a mano o contrastarlo con otro programa."
          : "Everything FilBio calculates is described here, so that any laboratory can reproduce it by hand or check it against other software."}
      </p>

      <H2>{es ? "El índice de cada marcador" : "The index at each marker"}</H2>
      <p>
        {es ? "El índice de paternidad es un cociente de verosimilitudes: " : "The paternity index is a likelihood ratio: "}
        <M>
          IP = <i>X</i> / <i>Y</i>
        </M>
        {es
          ? ", donde X es la probabilidad de observar el genotipo del hijo si el presunto padre es el padre biológico, e Y la probabilidad de observarlo si lo es un hombre tomado al azar de la población. Ambas se obtienen sumando sobre las dos maneras en que los alelos del hijo pueden repartirse entre sus progenitores. Sin mutación, esa suma se reduce exactamente a las fórmulas clásicas:"
          : ", where X is the probability of observing the child's genotype if the alleged father is the biological father, and Y the probability of observing it if a man taken at random from the population is. Both are obtained by summing over the two ways the child's alleles can be split between the parents. With no mutation, that sum reduces exactly to the classical formulas:"}
      </p>

      <h3 className="mt-5 mb-2 font-semibold text-ink">{es ? "Trío: madre, hijo(a) y presunto padre" : "Trio: mother, child and alleged father"}</h3>
      <FormulaTable head={[es ? "Madre" : "Mother", es ? "Hijo(a)" : "Child", es ? "Presunto padre" : "Alleged father", "IP"]}>
        {TRIO.map(([known, child, alleged, formula], index) => (
          <tr key={index} className="border-b border-line">
            <Td>{or(known)}</Td>
            <Td>{child}</Td>
            <Td>{or(alleged)}</Td>
            <Td><M>{formula}</M></Td>
          </tr>
        ))}
      </FormulaTable>

      <h3 className="mt-5 mb-2 font-semibold text-ink">{es ? "Dúo: hijo(a) y presunto padre" : "Duo: child and alleged father"}</h3>
      <FormulaTable head={[es ? "Hijo(a)" : "Child", es ? "Presunto padre" : "Alleged father", "IP"]}>
        {DUO.map(([child, alleged, formula], index) => (
          <tr key={index} className="border-b border-line">
            <Td>{child}</Td>
            <Td>{alleged}</Td>
            <Td><M>{formula}</M></Td>
          </tr>
        ))}
      </FormulaTable>
      <p className="mt-3">
        {es
          ? "El orden en que se capturan los dos alelos no influye. En un dúo, compartir un alelo frecuente puede dar un índice menor que 1: es un resultado correcto, no un error. Aplicar 1/p a todo alelo compartido, sin atender a si cada persona es homocigota o heterocigota, sobrestima el índice entre dos y cuatro veces por marcador, y varios órdenes de magnitud en el índice combinado. Las mismas fórmulas valen cuando se investiga la maternidad."
          : "The order in which the two alleles are entered makes no difference. In a duo, sharing a common allele can give an index below 1: that is a correct result, not an error. Applying 1/p to every shared allele, regardless of whether each person is homozygous or heterozygous, overstates the index two- to four-fold per marker, and by several orders of magnitude in the combined index. The same formulas hold when maternity is in question."}
      </p>

      <H2>{es ? "Índice combinado y probabilidad" : "Combined index and probability"}</H2>
      <p>
        {es ? "El índice combinado es el producto de los índices de los marcadores. La probabilidad de paternidad es " : "The combined index is the product of the marker indices. The probability of paternity is "}
        <M>
          W = IPC · <i>π</i> / (IPC · <i>π</i> + 1 − <i>π</i>)
        </M>
        {es
          ? ", con probabilidad a priori π = 0.5 por convención, lo que da W = IPC / (IPC + 1). W se informa truncada, nunca redondeada hacia arriba, y jamás como 100 %: cuando excede lo que los decimales elegidos pueden mostrar se da como cota inferior (> 99.999999 %)."
          : ", with prior probability π = 0.5 by convention, which gives W = CPI / (CPI + 1). W is reported truncated, never rounded up, and never as 100 %: once it exceeds what the chosen decimals can show it is given as a lower bound (> 99.999999 %)."}
      </p>

      <H2>{es ? "Frecuencias alélicas" : "Allele frequencies"}</H2>
      <p>
        {es
          ? "El índice depende de la frecuencia del alelo en la población de referencia, de modo que la elección de la tabla importa. Una frecuencia estimada en una muestra finita es poco fiable cerca de cero, y un alelo que no apareció en la muestra no tiene frecuencia cero. Por eso toda frecuencia se acota inferiormente en "
          : "The index depends on the allele's frequency in the reference population, so the choice of table matters. A frequency estimated from a finite sample is unreliable near zero, and an allele that did not turn up in the sample does not have a frequency of zero. Every frequency is therefore floored at "}
        <M>5 / 2<i>N</i></M>
        {es
          ? " (NRC II, 1996), siendo 2N el número de cromosomas muestreados. Con 135 personas el mínimo es 0.0185: asignar 0.001 a un alelo no observado, como hacen algunas hojas de cálculo, le daría un índice de 1000 en lugar de 54. El detalle de cada marcador indica cuándo se aplicó el mínimo."
          : " (NRC II, 1996), 2N being the number of chromosomes sampled. With 135 people the minimum is 0.0185: assigning 0.001 to an unobserved allele, as some spreadsheets do, would give it an index of 1000 instead of 54. Each marker's detail shows when the minimum was applied."}
      </p>

      <H2>{es ? "Discordancias y mutación" : "Inconsistencies and mutation"}</H2>
      <p>
        {es
          ? "Cuando el hijo no puede haber recibido ninguno de los alelos del presunto padre, el marcador se evalúa como una posible mutación en lugar de darle índice cero. Las mutaciones de los STR son deslizamientos de la polimerasa: casi siempre ganan o pierden una sola repetición. En el modelo escalonado, un progenitor con tasa de mutación μ transmite un alelo a s repeticiones de distancia con probabilidad "
          : "When the child cannot have received any of the alleged father's alleles, the marker is evaluated as a possible mutation rather than given an index of zero. STR mutations are polymerase slippage: they nearly always gain or lose a single repeat. In the stepwise model, a parent with mutation rate μ transmits an allele s repeats away with probability "}
        <M>
          <i>μ</i> · ½ · (1 − <i>r</i>) · <i>r</i>
          <sup className="text-[0.7em]">
            <i>s</i>−1
          </sup>
        </M>
        {es
          ? ", con r = 0.1: la mitad de las mutaciones alarga y la mitad acorta, y cada paso adicional es diez veces menos probable. Para un solo alelo vecino esto equivale a la regla de Brenner, IP ≈ μ / 4p. Un cambio que no es un número entero de repeticiones (TH01 9.3 a 10) no es un deslizamiento y recibe una probabilidad mucho menor. Las tasas μ, paterna o materna según quién transmite, son las de la AABB (2003) tabuladas por NIST STRBase; los marcadores sin dato publicado usan el promedio. Como alternativa puede elegirse la fórmula de la AABB, IP = μ / A, con A el poder de exclusión medio del marcador, que no considera la distancia entre alelos."
          : ", with r = 0.1: half of mutations lengthen and half shorten, and each additional step is ten times less likely. For a single neighbouring allele this equals Brenner's rule, PI ≈ μ / 4p. A change that is not a whole number of repeats (TH01 9.3 to 10) is not slippage and receives a far smaller probability. The rates μ, paternal or maternal according to who transmits, are the AABB (2003) figures tabulated by NIST STRBase; markers with no published figure use the average. The AABB formula PI = μ / A, with A the marker's mean power of exclusion, can be chosen instead; it disregards the distance between alleles."}
      </p>
      <p className="mt-3">
        {es
          ? "Dos homocigotos para alelos distintos pueden deberse a un alelo nulo (silente) y no a una mutación; la herramienta lo señala pero no lo modela. Si es el progenitor conocido quien no comparte alelo con el hijo, el problema no es del presunto padre: se advierte que debe verificarse la identidad de las muestras."
          : "Two homozygotes for different alleles may be due to a null (silent) allele rather than a mutation; the tool flags this but does not model it. If it is the known parent who shares no allele with the child, the problem does not lie with the alleged father: a warning says the identity of the samples must be checked."}
      </p>

      <H2>{es ? "Decisión" : "Decision"}</H2>
      <p>
        {es
          ? "Tres o más marcadores discordantes con el presunto padre excluyen la paternidad. Con menos, se calcula W: si alcanza 99.99 % la paternidad no se excluye y se considera prácticamente probada; si no, el resultado es no concluyente y conviene ampliar el número de marcadores, sobre todo cuando la inclusión descansa en una mutación supuesta. Ambos umbrales y la probabilidad a priori se cambian en Ajustes. Inclusión y exclusión son resultados igualmente válidos; la herramienta reserva el color de advertencia para lo que requiere atención del analista."
          : "Three or more markers inconsistent with the alleged father exclude paternity. With fewer, W is calculated: if it reaches 99.99 % paternity is not excluded and is considered practically proven; otherwise the result is inconclusive and more markers should be typed, especially when the inclusion rests on an assumed mutation. Both thresholds and the prior can be changed in Settings. Inclusion and exclusion are equally valid results; the tool keeps its warning colour for what needs the analyst's attention."}
      </p>

      <H2>{es ? "Lo que no hace" : "What it does not do"}</H2>
      <ul className="list-disc space-y-1.5 pl-6">
        {(es
          ? [
              "No corrige por subestructura poblacional (θ) ni por parentesco entre los progenitores.",
              "No modela alelos nulos, perfiles parciales, mezclas ni patrones trialélicos.",
              "No resuelve casos de deficiencia (abuelos, hermanos, padre fallecido). Un índice de paternidad no sirve para comparar hermanos entre sí: eso requiere programas de pedigríes como Familias.",
              "Trata los marcadores como independientes, como es habitual en las pruebas de paternidad con los kits comerciales.",
            ]
          : [
              "It does not correct for population substructure (θ) or for relatedness between the parents.",
              "It does not model null alleles, partial profiles, mixtures or tri-allelic patterns.",
              "It does not solve deficiency cases (grandparents, siblings, a deceased father). A paternity index cannot be used to compare siblings with each other: that needs pedigree software such as Familias.",
              "It treats markers as independent, as is usual in paternity testing with commercial kits.",
            ]
        ).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <H2>{es ? "Cómo se verifica" : "How it is verified"}</H2>
      <p>
        {es
          ? "El motor calcula cada índice por enumeración de las transmisiones posibles y, por separado, deduce la fórmula clásica que corresponde; las pruebas automáticas exigen que ambos coincidan en las 1000 combinaciones de genotipos de un trío y las 100 de un dúo, además de contrastar las tablas de los libros de texto, casos de mutación resueltos a mano, el poder de exclusión por fuerza bruta y un perfil completo recalculado de forma independiente en otro lenguaje."
          : "The engine calculates each index by enumerating the possible transmissions and, separately, derives the classical formula that applies; the automated tests require the two to agree for all 1000 genotype combinations of a trio and all 100 of a duo, and also check the textbook tables, mutation cases worked by hand, the power of exclusion by brute force, and a full profile recalculated independently in another language."}
      </p>

      <H2>{es ? "Privacidad" : "Privacy"}</H2>
      <p>
        {es
          ? "Los perfiles genéticos son datos personales sensibles. Todo el cálculo ocurre en su navegador y los casos se guardan solo en él; el sitio son archivos estáticos sin servidor que reciba datos, y su política de seguridad de contenido impide al navegador conectarse a cualquier otro origen. Puede comprobarlo en la pestaña de red de las herramientas de desarrollo, o usando la página sin conexión."
          : "Genetic profiles are sensitive personal data. All calculation happens in your browser and cases are stored only there; the site is static files with no server to receive data, and its content security policy prevents the browser from connecting to any other origin. You can check this in the network tab of the developer tools, or by using the page offline."}
      </p>

      <H2>{es ? "Referencias" : "References"}</H2>
      <ol className="list-decimal space-y-1.5 pl-6 text-[0.95rem]">
        {REFERENCES.map((reference) => (
          <li key={reference}>{reference}</li>
        ))}
      </ol>
    </article>
  );
}

function H2({ children }: { children: ReactNode }) {
  return <h2 className="mt-9 mb-2 font-serif text-xl font-semibold text-ink">{children}</h2>;
}

function Td({ children }: { children: ReactNode }) {
  return <td className="px-3 py-1.5">{children}</td>;
}

function FormulaTable({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full border-collapse text-[0.95rem]">
        <thead>
          <tr className="border-b border-line-strong text-left text-muted">
            {head.map((cell) => (
              <th key={cell} scope="col" className="px-3 py-1.5 font-medium">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-ink">{children}</tbody>
      </table>
    </div>
  );
}
