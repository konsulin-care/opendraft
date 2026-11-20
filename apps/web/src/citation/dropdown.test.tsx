// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CitationDropdown, CitekeyItem } from "./dropdown";
import type { CitationState } from "./types";
import type { Reference } from "@opendraft/references";
import type { CrossrefLabel } from "@opendraft/manuscript";

const { mockResolveDoi, mockNormalizeDoi } = vi.hoisted(() => ({
  mockResolveDoi: vi.fn(),
  mockNormalizeDoi: vi.fn(),
}));

vi.mock("./doi-resolver", () => ({
  resolveDoi: (...args: unknown[]) => mockResolveDoi(...args),
  normalizeDoi: (...args: unknown[]) => mockNormalizeDoi(...args),
}));

const mockReferences: Reference[] = [
  {
    citeKey: "doe2024",
    entryType: "article",
    fields: { title: "Example Article", author: "Doe, Jane", year: "2024" },
  },
];

const mockCrossrefs: CrossrefLabel[] = [
  { id: "fig-cat", kind: "fig", caption: "A cat diagram", file: "body.qmd" },
  { id: "sec-intro", kind: "sec", caption: "Introduction", file: "intro.qmd" },
];

function createOpenState(overrides?: Partial<CitationState>): CitationState {
  return {
    open: true,
    query: "",
    items: mockReferences,
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

function renderDropdown(
  overrides?: Partial<CitationState>,
  onSelectCitekey?: (key: string) => void,
) {
  const dispatch = vi.fn();
  render(
    <CitationDropdown
      state={createOpenState(overrides)}
      dispatch={dispatch}
      onSelectCitekey={onSelectCitekey}
    />,
  );
  return dispatch;
}

function createReference(overrides?: Partial<Reference>): Reference {
  return {
    citeKey: "Sun2025",
    entryType: "article",
    fields: {
      title: "Integrating Qualitative Comparative Analysis With Reflexive Thematic Analysis in Theme Development",
      author: "Sun, Yi and Hsieh, Jasper and Gao, Xuesong (Andy)",
      year: "2025",
    },
    ...overrides,
  };
}

function renderItem(overrides?: Partial<Reference>, isActive = false) {
  const onSelect = vi.fn();
  render(
    <CitekeyItem item={createReference(overrides)} isActive={isActive} onSelect={onSelect} />,
  );
  return onSelect;
}

describe("CitationDropdown — rendering and empty states", () => {
  it("renders when open with Add Citation and no search input", () => {
    renderDropdown();
    expect(screen.getByText("Jane Doe")).toBeDefined();
    expect(screen.getByText(/Add Citation/)).toBeDefined();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(document.querySelectorAll(".citation-search")).toHaveLength(0);
    expect(screen.getByTestId("citation-dropdown").className).toContain(
      "milkdown-slash-menu",
    );
  });

  it("does not render when closed", () => {
    const { container } = render(
      <CitationDropdown state={{ ...createOpenState(), open: false }} dispatch={vi.fn()} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows the no-references message and keeps Add Citation", () => {
    renderDropdown({ items: [], query: "" });
    expect(screen.getByText(/No references yet/)).toBeDefined();
    expect(screen.getByText(/Add one by DOI/)).toBeDefined();
    expect(screen.getByText(/\+ Add Citation \(DOI\)/)).toBeDefined();
  });

  it("shows the bib load error instead of the empty-state text", () => {
    renderDropdown({ items: [], loadError: { message: "x", line: 12 } });
    expect(screen.getByText("references.bib could not be parsed (line 12)")).toBeDefined();
    expect(screen.queryByText(/No references yet/)).toBeNull();
  });

  it("shows no-match text and filters by citekey query", () => {
    renderDropdown({ query: "zzzzz" });
    expect(screen.getByText("No matching citations")).toBeDefined();
    renderDropdown({ query: "doe" });
    expect(screen.getAllByText("Jane Doe").length).toBeGreaterThan(0);
  });
});

describe("CitationDropdown — DOI resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts DOI loading when Enter is pressed in DOI mode", async () => {
    mockNormalizeDoi.mockReturnValue("10.1234/test");
    mockResolveDoi.mockResolvedValue("@article{test, title={Test}}");
    const dispatch = renderDropdown({ doiMode: true, doiInput: "10.1234/test" });
    fireEvent.keyDown(screen.getByPlaceholderText(/Enter DOI/), { key: "Enter" });
    await vi.waitFor(() => expect(dispatch).toHaveBeenCalled());
    expect(dispatch.mock.calls.map((c) => c[0].type)).toContain("SET_DOI_LOADING");
  });

  it("dispatches SET_ERROR for invalid DOI format", async () => {
    mockNormalizeDoi.mockReturnValue(null);
    const dispatch = renderDropdown({ doiMode: true, doiInput: "not a doi" });
    fireEvent.keyDown(screen.getByPlaceholderText(/Enter DOI/), { key: "Enter" });
    await vi.waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith({
        type: "SET_ERROR",
        error: { message: "Invalid DOI format" },
      }),
    );
  });
});

describe("CitationDropdown — keyboard navigation delegated to plugin", () => {
  it("does not handle keyboard events directly", () => {
    const dispatch = renderDropdown();
    const dropdown = screen.getByTestId("citation-dropdown");
    for (const key of ["ArrowDown", "ArrowUp", "Enter", "Escape"]) {
      fireEvent.keyDown(dropdown, { key });
    }
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe("CitekeyItem — layout and fallbacks", () => {
  it("renders author, year, type badge and title", () => {
    renderItem();
    expect(screen.getByText(/Yi Sun/)).toBeDefined();
    expect(screen.getByText(/\(2025\)/)).toBeDefined();
    expect(screen.getByText(/article/i)).toBeDefined();
    expect(screen.getByText(/Integrating Qualitative/)).toBeDefined();
    expect(document.querySelector(".citation-author")?.textContent).toBe("Yi Sun");
    expect(document.querySelector(".citation-key")).toBeNull();
  });

  it("falls back to citeKey when the author is missing or empty", () => {
    renderItem({ fields: { title: "Some Title", year: "2025" } });
    expect(document.querySelector(".citation-author")?.textContent).toBe("Sun2025");
    renderItem({ fields: { title: "Some Title", author: "", year: "2025" } });
    expect(document.querySelectorAll(".citation-author")[1]?.textContent).toBe("Sun2025");
  });

  it("omits the title line when the title is missing", () => {
    renderItem({ fields: { author: "Sun, Yi", year: "2025" } });
    expect(screen.getAllByRole("listitem")[0].querySelector(".citation-title")).toBeNull();
  });
});

describe("CitekeyItem — body wrapper, two rows and selection", () => {
  it("renders one body wrapper whose rows carry the expected fields", () => {
    renderItem();
    const li = screen.getByRole("listitem");
    expect(li.children.length).toBe(1);
    expect(li.children[0].className).toContain("citation-item-body");
    const line1 = li.children[0].children[0];
    const line2 = li.children[0].children[1];
    expect(line1.querySelector(".citation-author")?.textContent).toBe("Yi Sun");
    expect(line1.querySelector(".citation-year")?.textContent?.trim()).toBe("(2025)");
    expect(line1.querySelector(".citation-type")?.textContent).toBe("Article");
    expect(line2.querySelector(".citation-title")?.textContent).toContain(
      "Integrating Qualitative",
    );
    expect(line2.querySelector(".citation-title")?.getAttribute("title")).toBe(
      createReference().fields.title,
    );
    expect(line2.querySelector(".citation-key")).toBeNull();
  });

  it("omits both title and key when the entry has no title", () => {
    renderItem({ fields: { author: "Sun, Yi", year: "2025" } });
    const line2 = document.querySelector(".citation-item-body")?.children[1];
    expect(line2?.querySelector(".citation-title")).toBeNull();
    expect(line2?.querySelector(".citation-key")).toBeNull();
  });

  it("marks the active item and calls onSelect with the citekey on pointerUp", () => {
    const onSelect = renderItem(undefined, true);
    expect(screen.getByRole("listitem").className).toContain("hover");
    fireEvent.pointerUp(screen.getByRole("listitem"));
    expect(onSelect).toHaveBeenCalledWith("Sun2025");
  });
});

describe("CitationDropdown — cross-reference group rendering", () => {
  it("renders Cross-references with label id and caption above Citations", () => {
    renderDropdown({ crossrefs: mockCrossrefs });
    expect(screen.getByText("Cross-references")).toBeDefined();
    expect(screen.getByText("Citations")).toBeDefined();
    expect(screen.getByText("fig-cat")).toBeDefined();
    expect(screen.getByText("A cat diagram")).toBeDefined();
    expect(screen.getByText("Figure")).toBeDefined();
    expect(screen.getByText("body.qmd")).toBeDefined();
    const headings = Array.from(document.querySelectorAll(".citation-group-heading")).map(
      (el) => el.textContent,
    );
    expect(headings).toEqual(["Cross-references", "Citations"]);
  });

  it("hides the Citations heading when only cross-references match", () => {
    renderDropdown({ crossrefs: mockCrossrefs, query: "fig-", items: [] });
    expect(screen.getByText("Cross-references")).toBeDefined();
    expect(screen.queryByText("Citations")).toBeNull();
  });
});

describe("CitationDropdown — cross-reference activeIndex and selection", () => {
  it("highlights the first cross-reference at index 0 and first citation next", () => {
    const state = createOpenState({ crossrefs: mockCrossrefs, activeIndex: 0 });
    const { rerender } = render(<CitationDropdown state={state} dispatch={vi.fn()} />);
    expect(screen.getByText("fig-cat").closest("li")?.className).toContain("hover");
    expect(screen.getByText("Jane Doe").closest("li")?.className).not.toContain("hover");
    rerender(
      <CitationDropdown
        state={{ ...state, activeIndex: mockCrossrefs.length }}
        dispatch={vi.fn()}
      />,
    );
    expect(screen.getByText("fig-cat").closest("li")?.className).not.toContain("hover");
    expect(screen.getByText("Jane Doe").closest("li")?.className).toContain("hover");
  });

  it("calls onSelectCitekey with the label id for a cross-reference", () => {
    const onSelectCitekey = vi.fn();
    renderDropdown({ crossrefs: mockCrossrefs }, onSelectCitekey);
    fireEvent.pointerUp(screen.getByText("fig-cat").closest("li")!);
    expect(onSelectCitekey).toHaveBeenCalledWith("fig-cat");
  });

  it("calls onSelectCitekey with the citekey for a citation", () => {
    const onSelectCitekey = vi.fn();
    renderDropdown({ crossrefs: mockCrossrefs }, onSelectCitekey);
    fireEvent.pointerUp(screen.getByText("Jane Doe").closest("li")!);
    expect(onSelectCitekey).toHaveBeenCalledWith("doe2024");
  });
});
