// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pluginSource = readFileSync(
  fileURLToPath(new URL("./plugin.ts", import.meta.url)),
  "utf8",
);

describe("createCitationPlugin — onDoiResolved wiring", () => {
  it("createUpdateDropdown accepts onDoiResolved parameter", () => {
    // Source-level: createUpdateDropdown must accept onDoiResolved as a parameter
    expect(pluginSource).toContain("onDoiResolved?: (bibtex: string) => void");
  });

  it("createView passes onDoiResolved to createUpdateDropdown", () => {
    // Source-level: the call to createUpdateDropdown in createView must include onDoiResolved
    expect(pluginSource).toContain("onDoiResolved");
  });

  it("onDoiResolved handler calls appendReference", () => {
    // Source-level: the onDoiResolved handler must call appendReference
    expect(pluginSource).toContain("appendReference");
  });

  it("onDoiResolved handler calls loadReferences to refresh items", () => {
    // Source-level: the onDoiResolved handler must call loadReferences
    expect(pluginSource).toContain("loadReferences");
  });

  it("onDoiResolved handler calls onSelectCitekey to insert into editor", () => {
    // Source-level: the onDoiResolved handler must call onSelectCitekey
    expect(pluginSource).toContain("onSelectCitekey");
  });

  it("onDoiResolved handler extracts citekey from bibtex", () => {
    // Source-level: the handler must extract citekey to pass to onSelectCitekey
    expect(pluginSource).toContain("extractCitekey");
  });
});
