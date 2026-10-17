import type { WorkspaceAdapter } from '@opendraft/workspace';
import { stringify } from 'yaml';
import protocolManifest from '../../../../protocol/protocol.manifest.json' with { type: 'json' };

/** Path of the project configuration file at the workspace root. */
export const OPENDRAFT_CONFIG_PATH = 'opendraft.yml';

/** Options for scaffolding a new project workspace. */
export interface ScaffoldOptions {
  /** Identifier for the initial manuscript (lowercase alphanumeric + hyphens). */
  manuscriptId: string;
}

/** Starter article, mirroring templates/manuscript/article.qmd. */
const ARTICLE_QMD = `---
metadata-files:
  - _author.yml
  - _abstract.yml
  - _frontmatter.yml
---

# Introduction

Write your introduction here.

# Methods

Write your methods here.

# Results

Write your results here.

# Discussion

Write your discussion here.

# References

::: {#refs}
:::
`;

/** Starter author metadata, mirroring templates/manuscript/_author.yml. */
const AUTHOR_YML = `authors:
  - name: Jane Doe
    orcid: "0000-0001-2345-6789"
    email: jane.doe@example.com
    corresponding: true
    affiliations:
      - name: University Example
        department: Computer Science
        city: "Cambridge"
        state: "MA"
        country: "US"
`;

/** Starter abstract, mirroring templates/manuscript/_abstract.yml. */
const ABSTRACT_YML = `abstract: |
  This paper presents your abstract here.
  Replace this text with a concise summary of your research,
  including background, objectives, methods, results, and conclusions.
`;

/** Starter frontmatter, mirroring templates/manuscript/_frontmatter.yml. */
const FRONTMATTER_YML = `title: "Article Title"
date: 2024-01-15
keywords:
  - keyword1
  - keyword2
`;

/** Starter references, mirroring templates/manuscript/references.bib. */
const REFERENCES_BIB = `@article{doe2024,
  title = {Example Article},
  author = {Doe, Jane},
  journal = {Journal of Examples},
  year = {2024},
  volume = {1},
  pages = {1--10}
}
`;

/**
 * Scaffold a new project workspace.
 *
 * Writes a spec-conformant `opendraft.yml` whose protocol block is copied
 * from protocol/protocol.manifest.json, plus the legacy five-file
 * manuscript layout under `manuscripts/<manuscriptId>/`.
 *
 * @param ws - Workspace adapter to write into (in-place).
 * @param options - Scaffold options; see {@link ScaffoldOptions}.
 */
export async function scaffoldProject(ws: WorkspaceAdapter, options: ScaffoldOptions): Promise<void> {
  const { manuscriptId } = options;
  const manuscriptPath = `manuscripts/${manuscriptId}`;

  const config = {
    protocol: protocolManifest.protocol,
    manuscripts: [{ id: manuscriptId, path: manuscriptPath }],
  };
  await ws.writeFile(OPENDRAFT_CONFIG_PATH, stringify(config));

  await ws.writeFile(`${manuscriptPath}/article.qmd`, ARTICLE_QMD);
  await ws.writeFile(`${manuscriptPath}/_author.yml`, AUTHOR_YML);
  await ws.writeFile(`${manuscriptPath}/_abstract.yml`, ABSTRACT_YML);
  await ws.writeFile(`${manuscriptPath}/_frontmatter.yml`, FRONTMATTER_YML);
  await ws.writeFile(`${manuscriptPath}/references.bib`, REFERENCES_BIB);
}
