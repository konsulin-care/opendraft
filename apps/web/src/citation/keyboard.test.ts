import { describe, it, expect } from "vitest";
import type { CrossrefLabel } from "@opendraft/manuscript";
import type { Reference } from "@opendraft/references";
import { createInitialState } from "./state";
import { resolveEnterKey } from "./keyboard";
import type { CitationState } from "./types";

const crossrefs: CrossrefLabel[] = [
  { id: "fig-cat", kind: "fig", caption: "A cat diagram", file: "intro.qmd" },
  { id: "sec-intro", kind: "sec", caption: "Introduction", file: "intro.qmd" },
];

const references: Reference[] = [
  {
    citeKey: "doe2024",
    entryType: "article",
    fields: { title: "Figure of a cat", author: "Doe, Jane", year: "2024" },
  },
];

/** Build a citation state on top of the production initial state. */
function stateWith(overrides: Partial<CitationState>): CitationState {
  return {
    ...createInitialState(),
    open: true,
    items: references,
    crossrefs,
    query: "cat",
    ...overrides,
  };
}

describe("resolveEnterKey", () => {
  it("returns the first cross-reference id when a cross-reference is the active suggestion", () => {
    const state = stateWith({ activeIndex: 0 });

    expect(resolveEnterKey(state)).toBe("fig-cat");
  });

  it("returns the citekey for a grouped trigger even when cross-references match the query", () => {
    const state = stateWith({
      activeIndex: 0,
      trigger: { from: 0, bracketed: true, grouped: true },
    });

    expect(resolveEnterKey(state)).toBe("doe2024");
  });

  it("returns null when activeIndex is past the end of the suggestion list", () => {
    const state = stateWith({ activeIndex: 99 });

    expect(resolveEnterKey(state)).toBeNull();
  });
});
