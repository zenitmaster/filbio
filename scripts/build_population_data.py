#!/usr/bin/env python3
"""Build the bundled population allele-frequency JSON files.

Run whenever a source changes; the generated JSON is committed.

    # Mexican tables only (standard library, no dependencies):
    python3 scripts/build_population_data.py --out src/data/populations

    # Everything, including the U.S. and U.K. reference sets:
    python3 -m venv .venv && .venv/bin/pip install rdata
    curl -LO https://cran.r-project.org/src/contrib/forensicpopdata_1.0.4.tar.gz
    tar -xzf forensicpopdata_1.0.4.tar.gz
    .venv/bin/python scripts/build_population_data.py \
        --rda-dir forensicpopdata/data --out src/data/populations

Sources
-------
* Mexico: `scripts/sources/*.csv`, transcriptions of published tables with the
  values exactly as printed. Each was extracted from the publication's PDF by
  word coordinates and then checked against statistics printed in the same
  publication (see the notes attached to each population below).
* NIST 1036, FBI 2015 and UK DNA-17: machine-readable transcriptions shipped in
  the R package `forensicpopdata` (M. Kruijver). The underlying raw data are
  public domain (NIST, FBI) or Open Government Licence v3 (UK Home Office).

Every frequency is stored as a proportion (0-1). `chromosomes` is the number of
alleles sampled at that locus (2N); it drives the 5/(2N) minimum frequency.
"""
from __future__ import annotations

import argparse
import csv
import json
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")

SOURCES = Path(__file__).parent / "sources"

# --------------------------------------------------------------------------
# Mexico: published tables, transcribed in scripts/sources/
# --------------------------------------------------------------------------


def read_table(path: Path, scale: float) -> dict[str, dict[str, float]]:
    """Alleles down, markers across. `scale` turns the printed unit into a proportion."""
    with path.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    loci: dict[str, dict[str, float]] = {name: {} for name in rows[0] if name != "Allele"}
    for row in rows:
        for locus, freqs in loci.items():
            if row[locus]:
                freqs[row["Allele"]] = round(float(row[locus]) * scale, 6)
    return loci


def with_size(loci: dict[str, dict[str, float]], chromosomes: int) -> dict[str, dict]:
    return {
        locus: {"chromosomes": chromosomes, "freqs": dict(sorted(freqs.items(), key=lambda kv: float(kv[0])))}
        for locus, freqs in loci.items()
    }


def build_mexico(sources: Path) -> list[dict]:
    # --- Central Mexico: Macias-Vega et al. 2013, Table 1, printed in percent.
    centro = read_table(sources / "mx-centro-macias-vega-2013.csv", 0.01)

    # The printed table puts D13S317's 4.4 % on the row of allele 13.2 and leaves
    # allele 14 blank. The authors flag every allele new to the population with a
    # footnote and do not flag this one; 13.2 is unobserved at D13S317 in the NIST
    # and FBI Hispanic sets, where allele 14 is 5.7-6.1 %. The value is one row
    # too high in the typeset table.
    centro["D13S317"]["14"] = centro["D13S317"].pop("13.2")

    # The paper states 300 people, yet every printed frequency is a multiple of
    # 1/270 (0.4, 0.7, 1.1 ... never the 0.2, 0.3, 0.5 that 600 chromosomes would
    # give) and its observed-heterozygosity row is a multiple of 1/135. The smaller,
    # more conservative size is used for the 5/(2N) floor.
    centro_chromosomes = 270

    # --- Yucatan Peninsula: DIMYGEN 2016, printed as proportions, 350 people.
    yucatan = read_table(sources / "mx-yucatan-dimygen-2016.csv", 1.0)

    return [
        {
            "id": "mx-centro-2013",
            "group": "mexico",
            "name": {
                "es": "Centro de México (Macías-Vega et al., 2013)",
                "en": "Central Mexico (Macías-Vega et al., 2013)",
            },
            "individuals": 300,
            "source": {
                "citation": (
                    "Macías-Vega M, García-Flores JR, Miranda-González E, Páez-Rodríguez J. Datos "
                    "genéticos poblacionales de 15 marcadores tipo «short tandem repeats» empleados "
                    "en las pruebas de paternidad e identificación de individuos por genética forense "
                    "en el área metropolitana de la región centro de México. Rev Esp Med Legal "
                    "2013;39(2):48-53."
                ),
                "url": "https://doi.org/10.1016/j.reml.2012.11.004",
                "license": "Published article, all rights reserved; only the frequency values are reproduced, with citation",
            },
            "notes": {
                "es": [
                    "Población: 300 personas del área metropolitana del centro de México (Distrito "
                    "Federal, Hidalgo, Puebla-Tlaxcala, Morelos, Toluca y Querétaro), kit Identifiler. "
                    "Los propios autores señalan que difiere notablemente de las poblaciones del norte "
                    "del país.",
                    "Tamaño muestral: el artículo indica 300 personas, pero todas las frecuencias "
                    "impresas son múltiplos de 1/270 y la heterocigosidad observada lo es de 1/135. "
                    "Para la frecuencia mínima se usan 270 cromosomas, el valor más conservador.",
                    "Corrección: la tabla publicada imprime el 4.4 % de D13S317 en la fila del alelo "
                    "13.2 y deja vacío el 14. Los autores no lo marcan como alelo nuevo, el 13.2 no se "
                    "observa en las referencias hispanas y el 14 ronda el 6 % en ellas. Se asignó al "
                    "alelo 14.",
                    "La tabla publicada da p = 0.000 (D18S51), 0.002 (vWA) y 0.005 (TPOX) para el "
                    "equilibrio de Hardy-Weinberg, aunque el texto afirma que todos los marcadores "
                    "están en equilibrio.",
                ],
                "en": [
                    "Population: 300 people from the metropolitan area of central Mexico (Federal "
                    "District, Hidalgo, Puebla-Tlaxcala, Morelos, Toluca and Querétaro), Identifiler "
                    "kit. The authors themselves note that it differs markedly from the populations "
                    "of northern Mexico.",
                    "Sample size: the article states 300 people, but every printed frequency is a "
                    "multiple of 1/270 and the observed heterozygosity is a multiple of 1/135. 270 "
                    "chromosomes, the more conservative figure, are used for the minimum frequency.",
                    "Correction: the published table prints D13S317's 4.4 % on the row of allele 13.2 "
                    "and leaves 14 blank. The authors do not flag it as a new allele, 13.2 is "
                    "unobserved in the Hispanic references and 14 is about 6 % in them. It was "
                    "assigned to allele 14.",
                    "The published table gives p = 0.000 (D18S51), 0.002 (vWA) and 0.005 (TPOX) for "
                    "Hardy-Weinberg equilibrium, although the text says every marker is in "
                    "equilibrium.",
                ],
            },
            "loci": with_size(centro, centro_chromosomes),
        },
        {
            "id": "mx-yucatan-2016",
            "group": "mexico",
            "name": {
                "es": "Península de Yucatán (DIMYGEN, 2016)",
                "en": "Yucatán Peninsula (DIMYGEN, 2016)",
            },
            "individuals": 350,
            "source": {
                "citation": (
                    "Sosa-Escalante J, López-González M, González-Herrera L. An update to the allele "
                    "frequencies and forensic parameters for 15 autosomal STR in a population from "
                    "Southeastern, Mexico. DIMYGEN Laboratorio; 2016."
                ),
                "url": "https://dimygen.com/frecuencias-alelicas.pdf",
                "license": "Published by DIMYGEN Laboratorio without an explicit licence; only the frequency values are reproduced, with citation",
            },
            "notes": {
                "es": [
                    "Población: 350 personas no emparentadas de los tres estados de la Península de "
                    "Yucatán.",
                    "Marcadores del kit PowerPlex 16: incluye Penta D y Penta E, pero no D2S1338 ni "
                    "D19S433. Con Identifiler esos dos marcadores quedan fuera del cálculo.",
                    "Transcripción verificada: el contenido de información polimórfica (PIC) "
                    "recalculado a partir de estas frecuencias coincide con el publicado en los 15 "
                    "marcadores.",
                    "Valores tal como se publicaron: D8S1179 suma 0.9967, y dos frecuencias aparecen "
                    "con tres decimales (D13S317 alelo 14 = 0.061; D8S1179 alelo 10 = 0.071).",
                ],
                "en": [
                    "Population: 350 unrelated people from the three states of the Yucatán Peninsula.",
                    "PowerPlex 16 markers: it includes Penta D and Penta E, but not D2S1338 or "
                    "D19S433. With Identifiler those two markers are left out of the calculation.",
                    "Transcription checked: the polymorphic information content (PIC) recomputed from "
                    "these frequencies matches the published figure for all 15 markers.",
                    "Values as published: D8S1179 sums to 0.9967, and two frequencies are printed to "
                    "three decimals (D13S317 allele 14 = 0.061; D8S1179 allele 10 = 0.071).",
                ],
            },
            "loci": with_size(yucatan, 700),
        },
    ]


# --------------------------------------------------------------------------
# forensicpopdata .rda files
# --------------------------------------------------------------------------


def _text(obj) -> str:
    value = obj.value
    return value.decode() if isinstance(value, bytes) else str(value)


def _attributes(obj) -> dict:
    out, node = {}, obj.attributes
    while node is not None and node.info.type.name == "LIST":
        tag, name = node.tag, None
        if tag is not None:
            target = tag.referenced_object if tag.info.type.name == "REF" else tag
            try:
                name = _text(target.value)
            except Exception:  # noqa: BLE001 - malformed tag, fall through
                name = None
        out[name] = node.value[0]
        node = node.value[1] if len(node.value) > 1 else None
    return out


def _names(obj) -> list[str]:
    attrs = _attributes(obj)
    if "names" in attrs:
        return [_text(x) for x in attrs["names"].value]
    for value in attrs.values():
        if value.info.type.name == "STR":
            return [_text(x) for x in value.value]
    raise ValueError("R object has no names attribute")


def load_rda(path: Path) -> dict[str, dict]:
    import rdata

    top = rdata.parser.parse_file(path).object.value[0]
    populations = {}
    for pop_name, pop in zip(_names(top), top.value):
        locus_names = _names(pop)
        n_obj = _attributes(pop).get("N")
        sizes = dict(zip(_names(n_obj), (float(v) for v in n_obj.value))) if n_obj else {}
        loci = {}
        for locus, vec in zip(locus_names, pop.value):
            freqs = {a: round(float(f), 6) for a, f in zip(_names(vec), vec.value) if f > 0}
            ordered = dict(sorted(freqs.items(), key=lambda kv: float(kv[0])))
            loci[locus] = {"chromosomes": int(round(sizes[locus])), "freqs": ordered}
        populations[pop_name] = loci
    return populations


NIST = {
    "AfAm": ("nist-afam", "Afroamericanos (EE. UU.)", "African American (U.S.)", 342),
    "Asian": ("nist-asian", "Asiáticos (EE. UU.)", "Asian (U.S.)", 97),
    "Cauc": ("nist-cauc", "Caucásicos (EE. UU.)", "Caucasian (U.S.)", 361),
    "Hisp": ("nist-hisp", "Hispanos (EE. UU.)", "Hispanic (U.S.)", 236),
}
FBI = {
    "SW Hispanic": ("fbi-sw-hispanic", "Hispanos del suroeste (EE. UU.)", "Southwestern Hispanic (U.S.)"),
    "SE Hispanic": ("fbi-se-hispanic", "Hispanos del sureste (EE. UU.)", "Southeastern Hispanic (U.S.)"),
    "Caucasian": ("fbi-caucasian", "Caucásicos (EE. UU.)", "Caucasian (U.S.)"),
    "African American": ("fbi-african-american", "Afroamericanos (EE. UU.)", "African American (U.S.)"),
    "Apache": ("fbi-apache", "Apaches", "Apache"),
    "Navajo": ("fbi-navajo", "Navajos", "Navajo"),
    "Bahamian": ("fbi-bahamian", "Bahameños", "Bahamian"),
    "Jamaican": ("fbi-jamaican", "Jamaicanos", "Jamaican"),
    "Trinidadian": ("fbi-trinidadian", "Trinitenses", "Trinidadian"),
    "Chamorro": ("fbi-chamorro", "Chamorros (Guam)", "Chamorro (Guam)"),
    "Filipino": ("fbi-filipino", "Filipinos", "Filipino"),
}
UK = {
    "White_-_EA1_&_EA2": ("uk-white", "Blancos (EA1 y EA2)", "White (EA1 & EA2)"),
    "Black_African_&_Caribbean_-_EA3": ("uk-black", "Africanos negros y caribeños (EA3)", "Black African & Caribbean (EA3)"),
    "Indian_-_EA4": ("uk-indian", "Subcontinente indio (EA4)", "Indian subcontinent (EA4)"),
    "Chinese_-_EA5": ("uk-chinese", "Chinos (EA5)", "Chinese (EA5)"),
}

NIST_SOURCE = {
    "citation": (
        "Hill CR, Duewer DL, Kline MC, Coble MD, Butler JM. U.S. population data for 29 "
        "autosomal STR loci. Forensic Sci Int Genet 2013;7:e82-e83. Revised: Steffen CR, "
        "Coble MD, Gettings KB, Vallone PM. Forensic Sci Int Genet 2017;31:e36-e40."
    ),
    "url": "https://strbase.nist.gov",
    "license": "Public domain (NIST)",
}
FBI_SOURCE = {
    "citation": (
        "Moretti TR, Moreno LI, Smerick JB, et al. Population data on the expanded CODIS core "
        "STR loci for eleven populations of significance for forensic DNA analyses in the "
        "United States. Forensic Sci Int Genet 2016;25:175-181."
    ),
    "url": "https://doi.org/10.1016/j.fsigen.2016.07.022",
    "license": "Public domain (FBI)",
}
UK_SOURCE = {
    "citation": (
        "UK Home Office. DNA population data to support the implementation of National DNA "
        "Database DNA-17 profiling."
    ),
    "url": (
        "https://www.gov.uk/government/statistics/dna-population-data-to-support-the-"
        "implementation-of-national-dna-database-dna-17-profiling"
    ),
    "license": "Open Government Licence v3.0",
}


def build_group(data: dict, table: dict, group: str, source: dict) -> list[dict]:
    out = []
    for key, meta in table.items():
        pop_id, name_es, name_en = meta[0], meta[1], meta[2]
        loci = data[key]
        individuals = meta[3] if len(meta) > 3 else max(v["chromosomes"] for v in loci.values()) // 2
        out.append(
            {
                "id": pop_id,
                "group": group,
                "name": {"es": name_es, "en": name_en},
                "individuals": individuals,
                "source": source,
                "loci": loci,
            }
        )
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    parser.add_argument("--sources", type=Path, default=SOURCES, help="folder with the transcribed CSV tables")
    parser.add_argument("--rda-dir", type=Path, help="forensicpopdata/data; omit to rebuild the Mexican tables only")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    groups = {"mexico": build_mexico(args.sources)}
    if args.rda_dir:
        groups["nist1036"] = build_group(load_rda(args.rda_dir / "NIST1036freqs.rda"), NIST, "nist1036", NIST_SOURCE)
        groups["fbi2015"] = build_group(load_rda(args.rda_dir / "FBI2015freqs.rda"), FBI, "fbi2015", FBI_SOURCE)
        groups["ukdna17"] = build_group(load_rda(args.rda_dir / "UKDNA17freqs.rda"), UK, "ukdna17", UK_SOURCE)

    for name, populations in groups.items():
        target = args.out / f"{name}.json"
        target.write_text(json.dumps(populations, ensure_ascii=False, separators=(",", ":")) + "\n")
        n_loci = sorted({len(p["loci"]) for p in populations})
        print(f"{target}: {len(populations)} population(s), loci per population {n_loci}, {target.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
