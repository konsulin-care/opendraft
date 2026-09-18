// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CitationDropdown } from "./dropdown";
import type { CitationState } from "./types";
import type { Reference } from "@opendraft/references";

const mockReference: Reference = {
  citeKey: "doe2024",
  entryType: "article",
  fields: { title: "Example Article", author: "Doe, Jane", year: "2024" },
};

function createOpenState(overrides?: Partial<CitationState>): CitationState {
  return {
    open: true,
    query: "",
    items: [mockReference],
    activeIndex: 0,
    trigger: { from: 5, bracketed: false },
    doiMode: false,
    doiInput: "",
    doiLoading: false,
    comparison: null,
    error: null,
    ...overrides,
  };
}

function createComparisonState(): CitationState {
  return createOpenState({
    comparison: {
      current: mockReference,
      incoming: mockReference,
      editedBibtex: "@article{doe2024, title={Test}}",
      originalCitekey: "doe2024",
    },
  });
}

const cssSource = readFileSync(
  resolve(__dirname, "../index.css"),
  "utf8",
);

describe("CitationDropdown — comparison view is not clipped (CSS)", () => {
  it("citation-dropdown has no max-height or overflow:hidden", () => {
    // Find the .citation-dropdown rule block
    const dropdownRule = cssSource.match(
      /\.citation-dropdown\s*\{[^}]+\}/,
    );
    expect(dropdownRule).not.toBeNull();
    const rule = dropdownRule![0];
    // Must not constrain height
    expect(rule).not.toMatch(/max-height\s*:/);
    expect(rule).not.toMatch(/overflow\s*:\s*hidden/);
  });

  it("citation-dropdown widens when comparison view is present", () => {
    // There must be a :has(.citation-comparison) rule or a modifier class
    // that makes the dropdown wider (>=480px) for comparison view
    const hasComparisonRule = cssSource.includes(":has(.citation-comparison)")
      || cssSource.includes(".citation-dropdown.comparison")
      || cssSource.includes(".citation-comparison-active");
    expect(hasComparisonRule).toBe(true);
  });

  it("citation-items still has bounded height for scrolling", () => {
    const itemsRule = cssSource.match(
      /\.citation-items\s*\{[^}]+\}/,
    );
    expect(itemsRule).not.toBeNull();
    const rule = itemsRule![0];
    expect(rule).toMatch(/max-height\s*:\s*200px/);
    expect(rule).toMatch(/overflow-y\s*:\s*auto/);
  });
});

describe("CitationDropdown — comparison view renders correctly", () => {
  it("renders comparison view with both panels", () => {
    const state = createComparisonState();
    render(<CitationDropdown state={state} dispatch={vi.fn()} />);
    expect(screen.getByText("Current")).toBeDefined();
    expect(screen.getByText("New (from DOI)")).toBeDefined();
  });

  it("renders action buttons in comparison view", () => {
    const state = createComparisonState();
    render(<CitationDropdown state={state} dispatch={vi.fn()} />);
    const replaceBtn = screen.getByText("Replace");
    const discardBtn = screen.getByText("Discard");
    expect(replaceBtn.tagName).toBe("BUTTON");
    expect(discardBtn.tagName).toBe("BUTTON");
    // Buttons must be in the actions container
    const actionsContainer = replaceBtn.closest(".citation-comparison-actions");
    expect(actionsContainer).not.toBeNull();
    expect(actionsContainer?.contains(discardBtn)).toBe(true);
  });
});

describe("CitationDropdown — citekey list still scrolls", () => {
  it("renders citation-items container", () => {
    const state = createOpenState({
      items: Array.from({ length: 10 }, (_, i) => ({
        citeKey: `ref${i}`,
        entryType: "article",
        fields: { title: `Title ${i}`, author: "Author", year: "2024" },
      })),
    });
    const { container } = render(
      <CitationDropdown state={state} dispatch={vi.fn()} />
    );
    const itemsContainer = container.querySelector(".citation-items");
    expect(itemsContainer).not.toBeNull();
    expect(screen.getByText("ref0")).toBeDefined();
    expect(screen.getByText("ref9")).toBeDefined();
  });
});
