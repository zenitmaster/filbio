import { alleleLength, hasAllele, type Allele, type DyeChannel, type Genotype } from "@/lib/genetics";

/**
 * A locus drawn the way analysts compare it: one electropherogram lane per
 * person on a shared allele axis, the child in the middle so that inheritance
 * reads inwards from both parents. A homozygote is a single peak of double
 * height, as it is on the instrument. Hairlines join the alleles a parent and
 * the child have in common; a child allele the alleged parent cannot supply is
 * drawn in the attention colour instead.
 */

export interface TraceLane {
  code: string;
  genotype?: Genotype;
  kind: "known" | "child" | "alleged";
}

const WIDTH = 184;
const GUTTER = 22;
const LANE = 15;
const PAD_TOP = 3;
const HET_HEIGHT = 6.5;
const HOM_HEIGHT = 12;

export const DYE_VAR: Record<DyeChannel, string> = {
  blue: "var(--dye-blue)",
  green: "var(--dye-green)",
  yellow: "var(--dye-yellow)",
  red: "var(--dye-red)",
  purple: "var(--dye-purple)",
};

function peakPath(x: number, base: number, height: number): string {
  const top = base - height;
  return (
    `M${x - 6} ${base}C${x - 2.6} ${base} ${x - 2.2} ${top} ${x} ${top}` +
    `C${x + 2.2} ${top} ${x + 2.6} ${base} ${x + 6} ${base}`
  );
}

export function LocusTrace({
  lanes,
  repeatLength,
  dye,
  unexplained,
  label,
}: {
  lanes: TraceLane[];
  repeatLength: number;
  dye: DyeChannel;
  /** Child alleles the alleged parent would have to supply but does not carry. */
  unexplained: Allele[];
  label: string;
}) {
  const position = (allele: Allele) => alleleLength(allele, repeatLength) / repeatLength;
  const values = lanes.flatMap((lane) => (lane.genotype ? lane.genotype.map(position) : []));
  const height = PAD_TOP + lanes.length * LANE + 1;

  // Keep at least four repeats in view so neighbouring alleles do not fly apart.
  const low = values.length ? Math.min(...values) : 0;
  const high = values.length ? Math.max(...values) : 1;
  const span = Math.max(high - low, 4);
  const start = (low + high) / 2 - span / 2 - 0.9;
  const scale = (WIDTH - GUTTER - 4) / (span + 1.8);
  const x = (allele: Allele) => GUTTER + (position(allele) - start) * scale;
  const baseline = (index: number) => PAD_TOP + (index + 1) * LANE - 2;

  const childIndex = lanes.findIndex((lane) => lane.kind === "child");
  const child = lanes[childIndex]?.genotype;
  const color = DYE_VAR[dye];

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${WIDTH} ${height}`}
      width={WIDTH}
      height={height}
      className="block shrink-0"
    >
      {lanes.map((lane, index) => (
        <g key={lane.kind}>
          <text
            x={0}
            y={baseline(index) - 2}
            className="fill-faint text-[9px] font-medium"
          >
            {lane.code}
          </text>
          <line
            x1={GUTTER - 2}
            x2={WIDTH}
            y1={baseline(index)}
            y2={baseline(index)}
            stroke="var(--line-strong)"
            strokeWidth={0.75}
          />
        </g>
      ))}

      {/* Hairlines between a parent's allele and the same allele in the child. */}
      {child &&
        lanes.map((lane, index) => {
          if (lane.kind === "child" || !lane.genotype) return null;
          const parent = lane.genotype;
          const shared = [...new Set(child)].filter((allele) => hasAllele(parent, allele));
          const [from, to] = [Math.min(index, childIndex), Math.max(index, childIndex)];
          return shared.map((allele) => (
            <line
              key={`${lane.kind}-${allele}`}
              x1={x(allele)}
              x2={x(allele)}
              y1={baseline(from) + 1}
              y2={baseline(to) - HET_HEIGHT - 1}
              stroke={color}
              strokeWidth={1}
              strokeDasharray="2 2"
              opacity={0.75}
            />
          ));
        })}

      {lanes.map((lane, index) => {
        if (!lane.genotype) return null;
        const [a, b] = lane.genotype;
        const homozygous = a === b;
        const alleles = homozygous ? [a] : [a, b];
        return alleles.map((allele) => {
          // A child allele with no one to have come from takes the attention colour.
          const orphan = lane.kind === "child" && unexplained.includes(allele);
          // Otherwise a peak is drawn boldly when it takes part in the inheritance shown.
          const linked =
            lane.kind === "child"
              ? lanes.some((other) => other.kind !== "child" && other.genotype && hasAllele(other.genotype, allele))
              : Boolean(child && hasAllele(child, allele));
          const stroke = orphan ? "var(--attention)" : color;
          return (
            <path
              key={`${lane.kind}-${allele}`}
              d={peakPath(x(allele), baseline(index), homozygous ? HOM_HEIGHT : HET_HEIGHT)}
              fill={stroke}
              fillOpacity={orphan ? 0.35 : linked ? 0.22 : 0}
              stroke={stroke}
              strokeOpacity={orphan || linked ? 1 : 0.42}
              strokeWidth={orphan ? 1.6 : 1.25}
              strokeLinejoin="round"
            />
          );
        });
      })}
    </svg>
  );
}
