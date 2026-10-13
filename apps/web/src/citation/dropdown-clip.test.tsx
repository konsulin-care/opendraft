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

describe("CitationDropdown — uses slash menu classes", () => {
  it("renders with milkdown-slash-menu class", () => {
    const state = createOpenState();
    render(<CitationDropdown state={state} dispatch={vi.fn()} />);
    const dropdown = screen.getByTestId("citation-dropdown");
    expect(dropdown.className).toBe("milkdown-slash-menu");
  });

  it("has data-show attribute", () => {
    const state = createOpenState();
    render(<CitationDropdown state={state} dispatch={vi.fn()} />);
    const dropdown = screen.getByTestId("citation-dropdown");
    expect(dropdown.getAttribute("data-show")).toBe("true");
  });

  it("citation-dropdown CSS rule is removed (uses slash menu styles)", () => {
    // The .citation-dropdown rule block should no longer exist
    const hasDropdownRule = cssSource.includes(".citation-dropdown {")
      || cssSource.match(/\.citation-dropdown\s*\{/);
    expect(hasDropdownRule).toBeFalsy();
  });

  it("data-show=false visibility rule exists", () => {
    expect(cssSource).toContain("[data-show='false']");
    expect(cssSource).toContain("display: none");
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
    const actionsContainer = replaceBtn.closest(".citation-comparison-actions");
    expect(actionsContainer).not.toBeNull();
    expect(actionsContainer?.contains(discardBtn)).toBe(true);
  });
});

describe("CitationDropdown — item body wrapper markup", () => {
  it("wraps item rows in a single .citation-item-body child of the li", () => {
    const state = createOpenState();
    const { container } = render(
      <CitationDropdown state={state} dispatch={vi.fn()} />
    );
    const author = container.querySelector(".citation-author");
    expect(author).not.toBeNull();
    const li = author?.closest("li");
    expect(li).not.toBeNull();
    expect(li?.children.length).toBe(1);
    expect(li?.children[0].classList.contains("citation-item-body")).toBe(true);
  });

  it("shows the citekey in a row-2 .citation-key element", () => {
    const state = createOpenState();
    const { container } = render(
      <CitationDropdown state={state} dispatch={vi.fn()} />
    );
    const key = container.querySelector(".citation-key");
    expect(key?.textContent).toBe("doe2024");
    expect(key?.closest(".citation-item-body")).not.toBeNull();
  });
});

describe("CitationDropdown — citekey list renders", () => {
  it("renders menu-groups container with items", () => {
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
    const menuGroups = container.querySelector(".menu-groups");
    expect(menuGroups).not.toBeNull();
    expect(screen.getAllByText("Author").length).toBeGreaterThanOrEqual(10);
  });
});
