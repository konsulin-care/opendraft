// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
  it("renders with milkdown-slash-menu and citation-dropdown classes", () => {
    const state = createOpenState();
    render(<CitationDropdown state={state} dispatch={vi.fn()} />);
    const dropdown = screen.getByTestId("citation-dropdown");
    expect(dropdown.className).toContain("milkdown-slash-menu");
    expect(dropdown.className).toContain("citation-dropdown");
  });

  it("has data-show attribute", () => {
    const state = createOpenState();
    render(<CitationDropdown state={state} dispatch={vi.fn()} />);
    const dropdown = screen.getByTestId("citation-dropdown");
    expect(dropdown.getAttribute("data-show")).toBe("true");
  });

  it("citation-dropdown CSS rule only fixes the width (min/max 380px)", () => {
    // Width is pinned via a .citation-dropdown rule; other slash menu styling is untouched.
    expect(cssSource).toMatch(/\.milkdown \.citation-dropdown\s*\{/);
    expect(cssSource).toMatch(/\.citation-dropdown\s*\{[^}]*min-width:\s*380px/);
    expect(cssSource).toMatch(/\.citation-dropdown\s*\{[^}]*max-width:\s*380px/);
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

  it("renders no .citation-key element in rows", () => {
    const state = createOpenState();
    const { container } = render(
      <CitationDropdown state={state} dispatch={vi.fn()} />
    );
    expect(container.querySelector(".citation-key")).toBeNull();
    expect(container.querySelector(".citation-title")).not.toBeNull();
  });
});

describe("CitationDropdown — Add Citation group", () => {
  it("renders .citation-add-btn inside its own .menu-group > ul after the citekey group", () => {
    const state = createOpenState();
    const { container } = render(
      <CitationDropdown state={state} dispatch={vi.fn()} />
    );
    const btn = container.querySelector(".citation-add-btn");
    expect(btn).not.toBeNull();
    expect(btn?.parentElement?.tagName).toBe("UL");
    const group = btn?.closest(".menu-group");
    expect(group?.parentElement).toBe(container.querySelector(".menu-groups"));
  });

  it("dispatches ENTER_DOI_MODE on pointerUp of the add button", () => {
    const state = createOpenState();
    const dispatch = vi.fn();
    const { container } = render(
      <CitationDropdown state={state} dispatch={dispatch} />
    );
    fireEvent.pointerUp(container.querySelector(".citation-add-btn")!);
    expect(dispatch).toHaveBeenCalledWith({ type: "ENTER_DOI_MODE" });
  });

  it("still shows the add-citation group when there are no items", () => {
    const state = createOpenState({ items: [], query: "" });
    const { container } = render(
      <CitationDropdown state={state} dispatch={vi.fn()} />
    );
    const groups = container.querySelectorAll(".menu-groups > .menu-group");
    expect(groups.length).toBe(2);
    expect(groups[1].querySelector(".citation-add-btn")).not.toBeNull();
    expect(screen.getByText(/No references yet/)).toBeDefined();
  });
});

describe("CitationDropdown — citekey list renders", () => {
  it("has no li as a direct child of .menu-groups (add button lives in its own group)", () => {
    const state = createOpenState();
    const { container } = render(
      <CitationDropdown state={state} dispatch={vi.fn()} />
    );
    const menuGroups = container.querySelector(".menu-groups");
    expect(menuGroups).not.toBeNull();
    const bareLis = Array.from(menuGroups?.children ?? []).filter(
      (el) => el.tagName === "LI"
    );
    expect(bareLis).toHaveLength(0);
    const addBtn = container.querySelector(".citation-add-btn");
    expect(addBtn?.closest(".menu-group > ul")).not.toBeNull();
  });

  it("renders the add-citation menu group after the citekey list group", () => {
    const state = createOpenState();
    const { container } = render(
      <CitationDropdown state={state} dispatch={vi.fn()} />
    );
    const groups = container.querySelectorAll(".menu-groups > .menu-group");
    expect(groups.length).toBe(2);
    expect(groups[0].querySelector(".citation-item-body")).not.toBeNull();
    expect(groups[1].querySelector(".citation-add-btn")).not.toBeNull();
  });

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
