// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CitationDropdown } from "./dropdown";
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

const existingReference: Reference = {
  citeKey: "naeem_2023",
  entryType: "article",
  fields: {
    title: "A Step-by-Step Process of Thematic Analysis",
    author: "Naeem, Muhammad and Ozuem, Wilson",
    year: "2023",
  },
};

const newDoiBibtex =
  "@article{smith_2024, title={New Research}, author={Smith, John}, year={2024}}";

const duplicateDoiBibtex =
  "@article{naeem_2023, title={Updated Title}, author={Naeem, Muhammad}, year={2023}}";

function createOpenState(overrides?: Partial<CitationState>): CitationState {
  return {
    open: true,
    query: "",
    items: [existingReference],
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

function renderDoiMode(opts: { doi?: string; dispatch?: ReturnType<typeof vi.fn>; onDoiResolved?: ReturnType<typeof vi.fn> } = {}) {
  const dispatch = opts.dispatch ?? vi.fn();
  const onDoiResolved = opts.onDoiResolved ?? vi.fn().mockResolvedValue(undefined);
  const state = createOpenState({ doiMode: true, doiInput: opts.doi ?? "10.9999/new" });
  render(
    <CitationDropdown state={state} dispatch={dispatch} onDoiResolved={onDoiResolved} />
  );
  return { dispatch, onDoiResolved };
}

describe("DOI resolution — new DOI skips comparison view", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("calls onDoiResolved directly when citekey is new (not in items)", async () => {
    mockNormalizeDoi.mockReturnValue("10.9999/new");
    mockResolveDoi.mockResolvedValue(newDoiBibtex);
    const { dispatch, onDoiResolved } = renderDoiMode();
    fireEvent.keyDown(screen.getByPlaceholderText(/Enter DOI/), { key: "Enter" });
    await vi.waitFor(() => { expect(onDoiResolved).toHaveBeenCalledWith(newDoiBibtex); });
    const dispatchTypes = dispatch.mock.calls.map((c) => c[0].type);
    expect(dispatchTypes).not.toContain("SET_COMPARISON");
  });

  it("awaits onDoiResolved before dispatching CLOSE_CITATION", async () => {
    mockNormalizeDoi.mockReturnValue("10.9999/new");
    mockResolveDoi.mockResolvedValue(newDoiBibtex);
    let resolveDoiResolved: () => void;
    const onDoiResolved = vi.fn().mockImplementation(
      () => new Promise<void>((r) => { resolveDoiResolved = r; })
    );
    const { dispatch } = renderDoiMode({ onDoiResolved });
    fireEvent.keyDown(screen.getByPlaceholderText(/Enter DOI/), { key: "Enter" });
    await vi.waitFor(() => { expect(onDoiResolved).toHaveBeenCalled(); });
    const typesBefore = dispatch.mock.calls.map((c) => c[0].type);
    expect(typesBefore).not.toContain("CLOSE_CITATION");
    resolveDoiResolved!();
    await vi.waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith({ type: "CLOSE_CITATION" });
    });
  });

  it("closes citation after saving new DOI", async () => {
    mockNormalizeDoi.mockReturnValue("10.9999/new");
    mockResolveDoi.mockResolvedValue(newDoiBibtex);
    const { dispatch } = renderDoiMode();
    fireEvent.keyDown(screen.getByPlaceholderText(/Enter DOI/), { key: "Enter" });
    await vi.waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith({ type: "CLOSE_CITATION" });
    });
  });
});

describe("DOI resolution — duplicate DOI shows comparison view", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows comparison view when citekey exists in items", async () => {
    mockNormalizeDoi.mockReturnValue("10.1177/16094069231205789");
    mockResolveDoi.mockResolvedValue(duplicateDoiBibtex);

    const { dispatch, onDoiResolved } = renderDoiMode({ doi: "10.1177/16094069231205789" });
    fireEvent.keyDown(screen.getByPlaceholderText(/Enter DOI/), { key: "Enter" });

    await vi.waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: "SET_COMPARISON" }),
      );
    });
    expect(onDoiResolved).not.toHaveBeenCalled();
  });

  it("comparison view has the real current entry (not empty @{})", async () => {
    mockNormalizeDoi.mockReturnValue("10.1177/16094069231205789");
    mockResolveDoi.mockResolvedValue(duplicateDoiBibtex);

    const { dispatch } = renderDoiMode({ doi: "10.1177/16094069231205789" });
    fireEvent.keyDown(screen.getByPlaceholderText(/Enter DOI/), { key: "Enter" });

    await vi.waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "SET_COMPARISON",
          comparison: expect.objectContaining({ current: existingReference }),
        }),
      );
    });
  });
});
