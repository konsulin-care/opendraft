// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CitationDropdown } from "./dropdown";
import type { CitationState } from "./types";
import type { Reference } from "@opendraft/references";

const mockReferences: Reference[] = [
  {
    citeKey: "doe2024",
    entryType: "article",
    fields: { title: "Example Article", author: "Doe, Jane", year: "2024" },
  },
];

function createOpenState(overrides?: Partial<CitationState>): CitationState {
  return {
    open: true,
    query: "",
    items: mockReferences,
    activeIndex: 0,
    trigger: { from: 5, bracketed: false, top: 100, left: 50 },
    doiMode: false,
    doiInput: "",
    doiLoading: false,
    comparison: null,
    error: null,
    ...overrides,
  };
}

describe("CitationDropdown — rendering", () => {
  it("renders when open", () => {
    const dispatch = vi.fn();
    const state = createOpenState();
    const scrollContainerRef = { current: document.createElement("div") };
    render(<CitationDropdown state={state} dispatch={dispatch} scrollContainerRef={scrollContainerRef} />);
    expect(screen.getByText("doe2024")).toBeDefined();
  });

  it("does not render when closed", () => {
    const dispatch = vi.fn();
    const state = { ...createOpenState(), open: false };
    const scrollContainerRef = { current: document.createElement("div") };
    const { container } = render(<CitationDropdown state={state} dispatch={dispatch} scrollContainerRef={scrollContainerRef} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders Add Citation item", () => {
    const dispatch = vi.fn();
    const state = createOpenState();
    const scrollContainerRef = { current: document.createElement("div") };
    render(<CitationDropdown state={state} dispatch={dispatch} scrollContainerRef={scrollContainerRef} />);
    expect(screen.getByText(/Add Citation/)).toBeDefined();
  });
});

describe("CitationDropdown — empty state", () => {
  it("shows helpful message when no items and empty query", () => {
    const dispatch = vi.fn();
    const state = createOpenState({ items: [], query: "" });
    const scrollContainerRef = { current: document.createElement("div") };
    render(<CitationDropdown state={state} dispatch={dispatch} scrollContainerRef={scrollContainerRef} />);
    expect(screen.getByText(/No references yet/)).toBeDefined();
    expect(screen.getByText(/Add one by DOI/)).toBeDefined();
  });

  it("still shows Add Citation button when no items", () => {
    const dispatch = vi.fn();
    const state = createOpenState({ items: [], query: "" });
    const scrollContainerRef = { current: document.createElement("div") };
    render(<CitationDropdown state={state} dispatch={dispatch} scrollContainerRef={scrollContainerRef} />);
    expect(screen.getByText(/\+ Add Citation \(DOI\)/)).toBeDefined();
  });

  it("shows \"No matching citations\" when query matches none", () => {
    const dispatch = vi.fn();
    const state = createOpenState({ query: "zzzzz" });
    const scrollContainerRef = { current: document.createElement("div") };
    render(<CitationDropdown state={state} dispatch={dispatch} scrollContainerRef={scrollContainerRef} />);
    expect(screen.getByText("No matching citations")).toBeDefined();
  });
});