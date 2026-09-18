import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, migrateSavedState, useAppStore } from "./index";

const state = () => useAppStore.getState();

// A duo arriving in a browser that still holds an earlier trio.
const CHILD = { D8S1179: ["10", "11"], AMEL: ["x", "x"] } satisfies Record<string, [string, string]>;
const FATHER = { D8S1179: ["11", "12"], AMEL: ["X", "Y"] } satisfies Record<string, [string, string]>;

describe("importProfiles", () => {
  beforeEach(() => state().loadExample("trio"));

  it("replaces a person's whole profile, not just the markers in the file", () => {
    expect(state().caseData.alleles.FGA.child).toEqual(["21", "24"]);
    state().importProfiles({ child: CHILD });
    expect(state().caseData.alleles.D8S1179.child).toEqual(["10", "11"]);
    expect(state().caseData.alleles.FGA.child).toEqual(["", ""]); // not in the file: gone
    expect(state().caseData.amelogenin.child).toEqual(["X", "X"]); // upper-cased
  });

  it("leaves the others alone unless told otherwise", () => {
    state().importProfiles({ child: CHILD, alleged: FATHER });
    expect(state().caseData.alleles.D8S1179.known).toEqual(["13", "14"]);
    expect(state().caseData.mode).toBe("trio");
  });

  it("can empty whoever the file leaves out, so an earlier case's mother cannot linger", () => {
    state().importProfiles({ child: CHILD, alleged: FATHER }, { clearOthers: true });
    const { alleles, amelogenin, mode } = state().caseData;
    expect(Object.values(alleles).every((entry) => entry.known.join("") === "")).toBe(true);
    expect(amelogenin.known).toEqual(["", ""]);
    expect(alleles.D8S1179.alleged).toEqual(["11", "12"]);
    expect(mode).toBe("duo"); // with the known parent gone, it is a duo
  });

  it("makes the case a trio when a known parent is imported", () => {
    state().updateCase({ mode: "duo" });
    state().importProfiles({ known: { D8S1179: ["13", "14"] } });
    expect(state().caseData.mode).toBe("trio");
  });

  it("adds markers the case had never seen", () => {
    expect(state().caseData.alleles.F13A01).toBeUndefined(); // no kit here types it, so no demo has it
    state().importProfiles({ child: { F13A01: ["5", "7"] } });
    expect(state().caseData.alleles.F13A01).toEqual({ known: ["", ""], child: ["5", "7"], alleged: ["", ""] });
  });
});

describe("opening defaults and saved state", () => {
  it("opens in English", () => {
    expect(DEFAULT_SETTINGS.locale).toBe("en");
  });

  it("moves a state saved before English became the default over to it, once", () => {
    const saved = { caseData: { caseId: "0042" }, settings: { locale: "es", kitId: "identifiler", populationId: "mx-centro-2013" } };
    expect(migrateSavedState(saved, 1)).toEqual({
      caseData: { caseId: "0042" }, // the case is kept
      // The kit and population are the laboratory's working choices: left alone.
      settings: { locale: "en", kitId: "identifiler", populationId: "mx-centro-2013" },
    });
  });

  it("respects a language chosen since then", () => {
    const saved = { settings: { locale: "es" } };
    expect(migrateSavedState(saved, 2)).toEqual({ settings: { locale: "es" } });
  });

  it("copes with nothing saved", () => {
    expect(migrateSavedState(undefined, 1)).toEqual({});
  });
});
