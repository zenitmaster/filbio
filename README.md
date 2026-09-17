# FilBio

Cálculo de filiación biológica (paternidad y maternidad) a partir de marcadores STR.
*Biological filiation (paternity and maternity) calculations from STR markers.*

FilBio takes the STR profiles of a child, an alleged parent and, when available, the
known parent, and returns the index at each marker, the combined index, the
probability of parentage and a printable report. The reference population can be
switched, imported from a spreadsheet, or edited.

It is a static site. There is no server, no account and no database: **genetic
profiles never leave the browser they are typed into.**

## What it does

- **Trio and duo** cases, for paternity or maternity, with the textbook likelihood-ratio
  formulas chosen from the genotypes (the order the two alleles are typed in is irrelevant).
- **Reference populations**: 20 bundled tables (see [Data](#data)), plus your own, pasted
  straight from Excel or loaded from CSV, then editable cell by cell and exportable.
- **Minimum allele frequency** of 5/(2N) per table, so a rare or unobserved allele cannot
  inflate the result.
- **Apparent mutations** evaluated with a stepwise model (or the AABB μ/A formula) and
  sex-specific AABB mutation rates, instead of scoring the marker as zero.
- **A verdict that follows the evidence**: exclusion at three or more inconsistent markers,
  inclusion when W reaches 99.99 %, otherwise *inconclusive, type more markers*. All
  thresholds are configurable.
- W is **truncated, never rounded up, and never printed as 100 %**.
- Checks the analyst would otherwise do by eye: a known parent who does not fit the child
  (sample mix-up), opposite homozygotes (possible null allele), amelogenin against the
  recorded sex, alleles absent from the population table.
- Kits: Identifiler, GlobalFiler, PowerPlex 16 / 21 / Fusion, NGM SElect. Markers are
  grouped by dye channel, in the order they are read off the electropherogram.
- Spreadsheet-style entry: arrow keys, Enter to move down a column, paste a block from Excel.
- Spanish and English, light and dark, printable report, cases saved to and opened from a file.

The method, with its formulas, limits and references, is documented inside the app under
**Método / Method** (`src/app/metodo/page.tsx`).

## Privacy

STR profiles are sensitive personal data, so the design removes the possibility of a leak
rather than promising not to cause one:

- Everything is computed in the browser. The build is plain static files (`output: "export"`).
- Cases, settings and custom populations live in the browser's `localStorage` only.
- A Content-Security-Policy (`connect-src 'self'`, `form-action 'none'`, no third-party
  origins) makes the browser itself refuse to send anything elsewhere.
- Fonts are self-hosted at build time; there are no analytics, trackers or CDNs.

To check: open the developer tools' Network tab while using it, or load the page and then
disconnect from the network. It keeps working.

## Develop

Requires Node.js 22 or later.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # genetics engine, importer and bundled-data tests
npm run lint
npm run build      # static site in out/
```

`out/` can be served by any static host (Vercel, GitHub Pages, an intranet web server).
`vercel.json` adds the security headers when deployed on Vercel.

### Layout

| Path | What is there |
| --- | --- |
| `src/lib/genetics/` | The engine: alleles, frequencies, mutation model, per-marker index, case verdict, number formatting. Pure TypeScript, no UI. |
| `src/lib/populations/` | Bundled population registry and the spreadsheet importer. |
| `src/lib/store/` | Case and settings state, persisted in the browser. |
| `src/lib/report/` | Report wording, Spanish and English. |
| `src/components/`, `src/app/` | Interface. |
| `src/data/populations/` | Generated frequency tables (JSON). |
| `scripts/build_population_data.py` | Regenerates those tables from their sources. |

### How the engine is tested

Each index is computed by enumerating the possible transmissions and, separately, the
closed-form textbook formula is derived from the genotypes. The tests require the two to
agree for all 1000 trio and all 100 duo genotype combinations, and additionally check the
textbook tables written out by hand, hand-worked mutation cases, the power-of-exclusion
formulas against brute-force enumeration, and a full 15-marker profile recomputed
independently in Python.

## Data

| Group | Populations | Markers | Source | Licence |
| --- | --- | --- | --- | --- |
| Laboratory | Mexico (laboratory table) | 15 | A laboratory's working table; stated origin SLAGF, *Rev Esp Med Legal* 2013;39(2):48-53, **not yet verified against that source** | Laboratory data |
| NIST 1036 | African American, Asian, Caucasian, Hispanic (U.S.) | 29 | Hill et al., *FSI Genet* 2013;7:e82; Steffen et al., 2017;31:e36 | Public domain |
| FBI 2015 | 11 U.S. and Caribbean populations, incl. SW and SE Hispanic | 23 | Moretti et al., *FSI Genet* 2016;25:175 | Public domain |
| UK DNA-17 | White, Black African & Caribbean, Indian subcontinent, Chinese | 16 | UK Home Office | OGL v3.0 |

The NIST, FBI and UK tables were read from the machine-readable transcriptions in the R
package [`forensicpopdata`](https://cran.r-project.org/package=forensicpopdata) (M. Kruijver).
Mutation rates are the AABB 2003 figures as tabulated by NIST STRBase.

The laboratory table carries notes, shown in the app, about its sample size, one corrected
transcription error and two values still to be verified. **Verify any table against its
published source before reporting casework with it**, and choose the population that
represents the people in the case.

## Scope

FilBio is a calculation aid. It does not replace a laboratory's validation, controls,
accreditation requirements or the judgement of the analyst who signs the report. It does not
model population substructure (θ), null alleles, mixtures or partial profiles, and it does
not handle deficiency cases (siblings, grandparents, a deceased parent): use pedigree
software such as Familias for those.

## Licence

Code: [MIT](LICENSE). The bundled frequency tables keep the licences of their sources, listed under [Data](#data).
