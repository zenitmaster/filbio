import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "./index";

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
    state().importProfiles({ child: { SE33: ["17", "28.2"] } });
    expect(state().caseData.alleles.SE33).toEqual({ known: ["", ""], child: ["17", "28.2"], alleged: ["", ""] });
  });
});
