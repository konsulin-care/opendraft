// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CitationDropdown, CitekeyItem } from "./dropdown";
import type { CitationState } from "./types";
import type { Reference } from "@opendraft/references";

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

describe("CitationDropdown — rendering", () => {
  it("renders when open", () => {
    const dispatch = vi.fn();
    const state = createOpenState();
    render(<CitationDropdown state={state} dispatch={dispatch} />);
    expect(screen.getByText("Jane Doe")).toBeDefined();
  });

  it("does not render when closed", () => {
    const dispatch = vi.fn();
    const state = { ...createOpenState(), open: false };
    const { container } = render(<CitationDropdown state={state} dispatch={dispatch} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders Add Citation item", () => {
    const dispatch = vi.fn();
    const state = createOpenState();
    render(<CitationDropdown state={state} dispatch={dispatch} />);
    expect(screen.getByText(/Add Citation/)).toBeDefined();
  });
});

describe("CitationDropdown — empty state", () => {
  it("shows helpful message when no items and empty query", () => {
    const dispatch = vi.fn();
    const state = createOpenState({ items: [], query: "" });
    render(<CitationDropdown state={state} dispatch={dispatch} />);
    expect(screen.getByText(/No references yet/)).toBeDefined();
    expect(screen.getByText(/Add one by DOI/)).toBeDefined();
  });

  it("still shows Add Citation button when no items", () => {
    const dispatch = vi.fn();
    const state = createOpenState({ items: [], query: "" });
    render(<CitationDropdown state={state} dispatch={dispatch} />);
    expect(screen.getByText(/\+ Add Citation \(DOI\)/)).toBeDefined();
  });

  it("shows \"No matching citations\" when query matches none", () => {
    const dispatch = vi.fn();
    const state = createOpenState({ query: "zzzzz" });
    render(<CitationDropdown state={state} dispatch={dispatch} />);
    expect(screen.getByText("No matching citations")).toBeDefined();
  });
});

describe("CitationDropdown — DOI resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls resolveDoi when Enter is pressed in DOI mode", async () => {
    mockNormalizeDoi.mockReturnValue("10.1234/test");
    mockResolveDoi.mockResolvedValue("@article{test, title={Test}}");

    const dispatch = vi.fn();
    const state = createOpenState({ doiMode: true, doiInput: "10.1234/test" });
    render(<CitationDropdown state={state} dispatch={dispatch} />);

    fireEvent.keyDown(screen.getByPlaceholderText(/Enter DOI/), { key: "Enter" });

    await vi.waitFor(() => {
      expect(dispatch).toHaveBeenCalled();
    });
    const types = dispatch.mock.calls.map((c) => c[0].type);
    expect(types).toContain("SET_DOI_LOADING");
  });

  it("dispatches SET_ERROR for invalid DOI format", async () => {
    mockNormalizeDoi.mockReturnValue(null);

    const dispatch = vi.fn();
    const state = createOpenState({ doiMode: true, doiInput: "not a doi" });
    render(<CitationDropdown state={state} dispatch={dispatch} />);

    fireEvent.keyDown(screen.getByPlaceholderText(/Enter DOI/), { key: "Enter" });

    await vi.waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith({ type: "SET_ERROR", error: { message: "Invalid DOI format" } });
    });
  });
});

describe("CitationDropdown — no search input (filtering via editor text)", () => {
  it("does not render a search input", () => {
    const dispatch = vi.fn();
    render(<CitationDropdown state={createOpenState()} dispatch={dispatch} />);
    const inputs = screen.queryAllByRole("textbox");
    expect(inputs).toHaveLength(0);
  });

  it("does not render a search input even with items", () => {
    const dispatch = vi.fn();
    render(<CitationDropdown state={createOpenState({ items: mockReferences })} dispatch={dispatch} />);
    const searchInputs = document.querySelectorAll(".citation-search");
    expect(searchInputs).toHaveLength(0);
  });
});

describe("CitationDropdown — prevents focus loss on dropdown click", () => {
  it("has onPointerDown handler on root element to prevent editor blur", () => {
    const dispatch = vi.fn();
    render(<CitationDropdown state={createOpenState()} dispatch={dispatch} />);
    const dropdown = screen.getByTestId("citation-dropdown");
    expect(dropdown).toBeDefined();
    expect(dropdown.className).toContain("citation-dropdown");
  });
});

describe("CitationDropdown — keyboard navigation delegated to plugin", () => {
  it("does not handle keyboard events directly (handled by ProseMirror plugin)", () => {
    const dispatch = vi.fn();
    render(<CitationDropdown state={createOpenState()} dispatch={dispatch} />);
    const dropdown = screen.getByTestId("citation-dropdown");
    fireEvent.keyDown(dropdown, { key: "ArrowDown" });
    fireEvent.keyDown(dropdown, { key: "ArrowUp" });
    fireEvent.keyDown(dropdown, { key: "Enter" });
    fireEvent.keyDown(dropdown, { key: "Escape" });
    expect(dispatch).not.toHaveBeenCalled();
  });
});

// ── CitekeyItem — new layout ──

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

describe("CitekeyItem — renders new layout", () => {
  it("renders formatted author and year on line 1", () => {
    const item = createReference();
    const onSelect = () => {};
    render(<CitekeyItem item={item} isActive={false} onSelect={onSelect} />);
    expect(screen.getByText(/Yi Sun/)).toBeDefined();
    expect(screen.getByText(/\(2025\)/)).toBeDefined();
  });

  it("renders entry type in muted text next to year", () => {
    const item = createReference();
    const onSelect = () => {};
    render(<CitekeyItem item={item} isActive={false} onSelect={onSelect} />);
    expect(screen.getByText(/article/i)).toBeDefined();
  });

  it("renders title on line 2", () => {
    const item = createReference();
    const onSelect = () => {};
    render(<CitekeyItem item={item} isActive={false} onSelect={onSelect} />);
    expect(screen.getByText(/Integrating Qualitative/)).toBeDefined();
  });

  it("applies active class when isActive is true", () => {
    const item = createReference();
    const onSelect = () => {};
    render(<CitekeyItem item={item} isActive={true} onSelect={onSelect} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[0].className).toContain("active");
  });
});

describe("CitekeyItem — fallback and edge cases", () => {
  it("does NOT display citeKey when author is present", () => {
    const item = createReference();
    const onSelect = () => {};
    render(<CitekeyItem item={item} isActive={false} onSelect={onSelect} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[0].textContent).not.toContain("Sun2025");
  });

  it("displays citeKey as fallback when author is missing", () => {
    const item = createReference({ fields: { title: "Some Title", year: "2025" } });
    const onSelect = () => {};
    render(<CitekeyItem item={item} isActive={false} onSelect={onSelect} />);
    expect(screen.getByText("Sun2025")).toBeDefined();
  });

  it("displays citeKey as fallback when author is empty string", () => {
    const item = createReference({ fields: { title: "Some Title", author: "", year: "2025" } });
    const onSelect = () => {};
    render(<CitekeyItem item={item} isActive={false} onSelect={onSelect} />);
    expect(screen.getByText("Sun2025")).toBeDefined();
  });

  it("omits title line when title is missing", () => {
    const item = createReference({ fields: { author: "Sun, Yi", year: "2025" } });
    const onSelect = () => {};
    render(<CitekeyItem item={item} isActive={false} onSelect={onSelect} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[0].querySelector(".citation-title")).toBeNull();
  });
});
