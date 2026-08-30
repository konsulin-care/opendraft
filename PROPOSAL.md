# OpenDraft — Product Requirements Document

**Status:** Draft for MVP  
**Project:** OpenDraft  
**Protocol:** OpenDraft Protocol  
**Primary goal:** Client-first, Git-native, decentralized scientific publication

---

## 1. Product Summary

OpenDraft is a client-first web application and open protocol for creating, managing, publishing, discovering, and semantically representing scientific publications.

OpenDraft is designed around the following principles:

1. A scientific project is primarily represented by a Git repository.
2. Manuscripts are ordinary files within that repository.
3. The repository remains usable without OpenDraft.
4. OpenDraft is a client-first PWA.
5. Manuscript source is written in Quarto Markdown (`.qmd`).
6. Structured manuscript metadata is maintained through dedicated YAML files.
7. Git is the source-control and provenance mechanism.
8. GitHub is initially the primary Git hosting and collaboration integration.
9. GitHub Actions performs publication builds.
10. Published articles are represented as both HTML and RDF/Turtle.
11. Publication RDF is independently verifiable.
12. The OpenDraft protocol itself is represented as RDF/Turtle and is versioned by Git commit.
13. No central publication database is required.
14. Discovery is performed through static RDF registries.
15. A registry can contain either publication registries or collection registries, but not both.
16. Human-authored semantic subjects are used for discovery in the MVP.
17. Machine-generated semantic annotation is explicitly outside the MVP.
18. The protocol is independent of OpenDraft's implementation.

---

# 2. Product Components

The initial OpenDraft monorepo contains:

```text
OpenDraft/
├── apps/
│   ├── web/
│   └── bff/
│
├── packages/
│   ├── editor/
│   ├── git/
│   ├── github/
│   ├── metadata/
│   ├── references/
│   ├── rdf/
│   └── quarto/
│
├── protocol/
│   ├── opendraft.ttl
│   ├── article.shacl.ttl
│   ├── registry.shacl.ttl
│   ├── registry.ttl
│   └── examples/
│
├── manuscripts/
│   └── distributed-scientific-publication/
│
├── templates/
│   └── manuscript/
│
├── tests/
│   └── conformance/
│
└── opendraft.yml
```

The monorepo contains:

- the OpenDraft PWA;
- the lightweight Go BFF;
- the OpenDraft protocol;
- RDF ontology;
- SHACL validation shapes;
- conformance tests;
- templates;
- examples;
- protocol documentation;
- the protocol's own explanatory manuscript.

OpenDraft is the reference implementation of the OpenDraft protocol, but OpenDraft itself is not the protocol authority.

---

# 3. Target Users

## 3.1 Scientific authors

Users should be able to:

- create a manuscript without knowing Git;
- edit Markdown;
- manage authors and metadata through forms;
- manage references through a dedicated interface;
- save work locally;
- synchronize with GitHub;
- collaborate through Git;
- publish versioned manuscripts.

## 3.2 Technical researchers

Users should be able to:

- use an existing Git repository;
- maintain source code and manuscripts together;
- manually edit OpenDraft files;
- use their own Git workflow;
- use OpenDraft only when useful.

## 3.3 Collaborators

Users should be able to:

- fork repositories;
- contribute manuscript changes;
- create pull requests;
- participate in issues;
- participate in discussions.

## 3.4 Readers and researchers

Users should be able to:

- discover registries;
- discover publication collections;
- retrieve article RDF;
- query semantic metadata locally;
- traverse publication relationships;
- access human-readable HTML.

---

# 4. Core Concepts

## 4.1 Research project

A research project is represented by a Git repository.

One repository may contain:

```text
manuscripts/
├── manuscript-a/
├── manuscript-b/
└── manuscript-c/
```

The repository may also contain:

```text
src/
tests/
data/
notebooks/
docs/
```

OpenDraft must therefore not assume that one repository equals one manuscript.

---

## 4.2 Manuscript

A manuscript is a directory under:

```text
/manuscripts/<manuscript-id>/
```

A manuscript minimally contains:

```text
article.qmd
_author.yml
_abstract.yml
_frontmatter.yml
references.bib
```

Additional files may include:

```text
_other.yml
figures/
data/
supplementary/
```

The exact directory name is user-defined.

---

## 4.3 Draft identity

A draft/project is identified by its repository and manuscript path.

Example:

```text
https://github.com/example/research-project
```

with:

```text
manuscripts/resilience-study/
```

The immutable source state is identified by a Git commit.

---

## 4.4 Publication identity

A publication version is identified by its DOI.

Each publication version must also retain provenance to:

- source repository;
- manuscript path;
- source Git commit;
- OpenDraft protocol revision.

---

## 4.5 Protocol identity

The OpenDraft protocol is represented by:

```text
protocol/opendraft.ttl
```

A specific protocol revision is identified by the full Git commit SHA of the OpenDraft repository.

A mutable branch or tag must not be used as the immutable protocol reference.

---

# 5. Repository Integration

A repository using OpenDraft contains:

```text
/opendraft.yml
```

This file declares the repository's OpenDraft integration.

Minimal conceptual structure:

```yaml
protocol:
  name: opendraft
  version: 0.1.0
  repository: https://github.com/example/OpenDraft
  commit: <full-commit-sha>

manuscripts:
  - id: example-manuscript
    path: manuscripts/example-manuscript
```

The protocol version and commit are managed by OpenDraft tooling rather than manually entered by ordinary users.

---

# 6. Quarto Source

The primary manuscript source is Quarto Markdown.

`article.qmd` should contain minimal metadata:

```yaml
---
metadata-files:
  - _author.yml
  - _abstract.yml
  - _frontmatter.yml
  - _other.yml
---
```

The OpenDraft UI manages these metadata files.

Users should not be required to manually construct complex YAML.

---

# 7. Metadata

Metadata is separated into maintainable YAML files.

Initial categories include:

- authors;
- abstract;
- title;
- keywords;
- semantic subjects;
- funding;
- acknowledgments;
- licensing;
- dates;
- related resources;
- other publication metadata.

OpenDraft should provide dedicated forms for these categories.

---

# 8. Authors and CRediT

Quarto-compatible author metadata is the primary source for declared authorship.

CRediT contribution information may be represented explicitly.

Git activity is supporting evidence for auditability.

Git activity must **not automatically determine authorship or CRediT roles**.

A person who contributes verbally, through discussion, review, or another non-Git mechanism can receive appropriate attribution without having Git commits.

Git activity may provide provenance such as:

- commits;
- pull requests;
- issues;
- discussions;
- reviews.

This evidence complements declared authorship rather than replacing it.

---

# 9. References

References are maintained in:

```text
references.bib
```

OpenDraft provides a dedicated reference-management interface.

The source remains a normal BibTeX file so that it remains interoperable with Quarto and other tooling.

Citations in the manuscript use standard Quarto/Pandoc citation syntax.

---

# 10. Semantic Subjects

Authors declare semantic subjects for discoverability.

Subjects are represented using SKOS concepts.

The MVP does not require machine-generated semantic annotation.

A human indexer may additionally assign semantic subjects.

This produces two useful provenance categories:

```text
author-declared subject
indexer-assigned subject
```

The source of each subject assignment must be distinguishable.

---

# 11. Publication Pipeline

The canonical publication pipeline is:

```text
Quarto Markdown
      ↓
Quarto compilation
      ↓
HTML
      +
Semantic compiler
      ↓
RDF/Turtle
```

The initial publication outputs are:

```text
article.html
article.ttl
```

PDF generation is a later capability.

Typst may be supported before JATS.

JATS is explicitly deferred until a later phase.

---

# 12. Git-Based Versioning

Git is the source of truth for source history.

OpenDraft does not require a manually maintained manuscript version field.

Publication versions use Git tags/releases where useful for human workflow.

Immutable provenance uses the full Git commit SHA.

Example:

```text
repository
    ↓
commit abc123...
    ↓
publication version
    ↓
DOI
```

---

# 13. DOI

Each published version receives its own DOI.

Therefore:

```text
Article A v1 → DOI-A-v1
Article A v2 → DOI-A-v2
```

Citation relationships are directed at the DOI of the cited publication version.

This intentionally represents a citation network as a versioned snapshot.

---

# 14. Publication RDF

Every published article has an `article.ttl`.

It must identify at minimum:

- publication;
- DOI;
- manuscript;
- repository;
- manuscript path;
- source commit;
- protocol revision;
- title;
- authors;
- abstract;
- subjects/keywords where present;
- references where present.

The RDF should provide provenance sufficient to reconstruct which source and protocol produced the publication.

---

# 15. Independently Verifiable Protocol Artifacts

The OpenDraft protocol is distributed as machine-readable artifacts.

At minimum:

```text
protocol/opendraft.ttl
protocol/article.shacl.ttl
protocol/registry.shacl.ttl
```

A protocol release must be independently identifiable through:

```text
OpenDraft repository
+
full Git commit SHA
+
artifact path
```

For example:

```text
https://github.com/example/OpenDraft/blob/<commit>/protocol/opendraft.ttl
```

The protocol artifact must not depend on the mutable `main` branch.

Protocol artifacts should eventually include cryptographic checksums or equivalent integrity information.

---

# 16. Protocol Self-Documentation

The protocol repository must document itself.

Human-readable protocol rationale is maintained as an OpenDraft manuscript:

```text
/manuscripts/distributed-scientific-publication/
```

This manuscript explains:

- motivation;
- architecture;
- terminology;
- identity model;
- repository model;
- registry model;
- discovery;
- publication lifecycle;
- semantic model;
- provenance;
- authorship;
- CRediT;
- peer review;
- dataset representation;
- security;
- decentralization;
- design rationale.

The protocol RDF contains concise machine-readable definitions.

The manuscript contains detailed explanatory documentation.

Normative machine constraints are represented through ontology and SHACL.

---

# 17. Registry Model

A registry is a static RDF/Turtle resource.

There are two registry types.

## 17.1 Collection registry

A collection registry contains references to other registries.

Conceptually:

```text
Collection Registry
├── Registry A
├── Registry B
└── Registry C
```

It does not directly contain publications.

## 17.2 Publication registry

A publication registry contains references to publications.

Conceptually:

```text
Publication Registry
├── Article A
├── Article B
└── Article C
```

It does not contain registries.

A registry must not mix the two models.

---

# 18. Registry Discovery

Discovery is hierarchical.

A client may start with any known registry.

The client:

```text
starting registry
      ↓
inspect registry type
      ↓
collection registry?
      │
      ├── yes → retrieve child registries
      │
      └── no → retrieve publications
```

A central OpenPublish/OpenDraft registry is therefore optional.

A user may instead configure any trusted registry as a discovery root.

This avoids a mandatory central authority.

---

# 19. Discovery Efficiency

Registries should contain semantic subjects describing the collection.

Example conceptual model:

```text
Collection Registry
    ├── subject: psychological resilience
    ├── subject: disaster recovery
    └── subject: mental health
```

A client can therefore narrow candidate registries before downloading every article.

The intended discovery process is:

```text
starting registry
      ↓
subject filtering
      ↓
candidate collection registries
      ↓
download relevant registry.ttl
      ↓
subject filtering
      ↓
publication registry
      ↓
select publications
      ↓
download article.ttl
```

The protocol should remain usable with 1,000, 1,000,000, or more publishers by allowing registries to be hierarchical rather than requiring one global flat index.

---

# 20. Peer Review

Peer review is represented using repository-native collaboration resources.

A review issue may correspond to:

```text
<repository>/issues/<number>
```

Repository-relative identifiers should use URI fragments or paths consistently according to the protocol's URI rules.

Review comments can be represented as issues.

A reviewer may classify a matter as discussion-only.

Discussion-only matters do not require rebuttal and do not necessarily affect publication acceptance.

GitHub is the initial implementation, but the protocol should refer to repository resources rather than make GitHub-specific semantics mandatory.

---

# 21. Data Availability

Public data may be represented using repository-relative paths or URLs.

Examples:

```text
data/dataset.csv
```

or:

```text
https://example.org/dataset
```

Sensitive data may remain outside the public repository.

A publication build may retrieve private data ephemerally.

Private credentials must be supplied through the CI environment/secrets.

The build must not publish private data as an artifact.

The protocol should distinguish:

- publicly available data;
- restricted data;
- unavailable/private data;
- data access instructions.

---

# 22. Client Architecture

OpenDraft is primarily a PWA.

The client should support:

- local manuscript editing;
- metadata forms;
- reference management;
- local Git repository management;
- Git synchronization;
- GitHub integration;
- repository selection;
- repository forking;
- pull requests;
- issues;
- discussions;
- publication discovery;
- RDF retrieval;
- local semantic querying.

---

# 23. Local Persistence

The browser workspace should use IndexedDB rather than relying exclusively on `localStorage`.

The local workspace should contain:

- manuscript files;
- Git objects;
- branches;
- working state;
- metadata;
- cached remote state.

The application should support offline drafting.

---

# 24. Git Integration

OpenDraft should perform Git operations client-side where practical.

Required operations include:

- initialize repository;
- clone/fetch;
- checkout;
- branch;
- status;
- diff;
- add;
- commit;
- merge;
- push.

A browser-compatible Git implementation should be used.

The Go BFF should not become a general-purpose Git proxy.

---

# 25. GitHub Integration

GitHub is an integration layer, not the protocol authority.

Two authorization modes are used.

### Existing repositories

Use GitHub App installation authorization.

### Privileged user operations

Use GitHub App user authorization.

Repository creation is a privileged user operation.

After repository creation, normal repository interaction should use the GitHub App installation.

---

# 26. Go BFF

The BFF exists primarily for secure GitHub authentication and authorization operations requiring server-side credentials.

The BFF should be:

- stateless or minimally stateful;
- lightweight;
- horizontally replaceable;
- free of manuscript storage;
- free of publication storage;
- free of search databases;
- free of background processing unless later required.

Target resource usage:

```text
CPU: < 0.25 vCPU under normal workload
RAM: < 30 MB
```

The BFF should use Go and preferably the standard library where practical.

---

# 27. Security

OpenDraft must follow least-privilege principles.

The GitHub App must request only the permissions required for its functionality.

The BFF must never expose:

- GitHub App private keys;
- OAuth client secrets;
- refresh tokens unnecessarily;
- installation private credentials.

The browser should receive only the credentials/tokens necessary for its operation.

The BFF must not provide arbitrary GitHub API proxying.

---

# 28. New Repository Workflow

When a user starts locally:

```text
OpenDraft
    ↓
new local project
    ↓
draft
    ↓
local Git repository
    ↓
sync
    ↓
GitHub authorization
    ↓
create repository
    ↓
push
```

The initial repository should contain:

```text
opendraft.yml
manuscripts/
.github/workflows/
```

and the selected manuscript structure.

---

# 29. Existing Repository Workflow

```text
OpenDraft
    ↓
Select repository
    ↓
GitHub authorization
    ↓
repository selection
    ↓
git fetch/clone
    ↓
inspect opendraft.yml
```

If `opendraft.yml` exists:

```text
load OpenDraft project
```

If it does not exist:

```text
inspect repository
    ↓
ask user
    ↓
initialize OpenDraft
```

OpenDraft must not silently modify arbitrary repositories.

---

# 30. Fork Workflow

```text
OpenDraft
    ↓
Fork from repository
    ↓
enter repository URL
    ↓
GitHub authorization
    ↓
select destination owner
    ↓
fork repository
    ↓
clone/fetch fork
    ↓
inspect opendraft.yml
    ↓
edit
```

Forking does not confer protocol authority.

The protocol version remains identified by its original immutable protocol commit.

---

# 31. Initialization of Generic Repositories

OpenDraft must support adding publication capabilities to an existing project.

Example:

```text
existing-project/
├── src/
├── tests/
├── README.md
└── LICENSE
```

After initialization:

```text
existing-project/
├── src/
├── tests/
├── README.md
├── LICENSE
├── opendraft.yml
├── manuscripts/
└── .github/
    └── workflows/
        └── opendraft.yml
```

OpenDraft must preserve existing project structure.

Initialization should occur in a single Git commit where practical.

---

# 32. Publication CI/CD

The repository's GitHub Actions workflow performs:

1. checkout manuscript source;
2. resolve the pinned OpenDraft protocol;
3. validate metadata;
4. validate RDF requirements;
5. run Quarto;
6. compile HTML;
7. compile RDF/Turtle;
8. validate RDF using SHACL;
9. publish static artifacts;
10. perform DOI release/versioning where configured.

OpenDraft itself does not need to trigger the workflow.

The repository's CI/CD configuration is authoritative for the build process.

---

# 33. Protocol Reproducibility

A publication must record:

```text
source repository
source commit
OpenDraft protocol repository
OpenDraft protocol commit
OpenDraft protocol version
```

This creates a reproducible chain:

```text
Publication
    ↓
Manuscript
    ↓
Source commit
    ↓
Protocol commit
    ↓
Protocol artifacts
```

---

# 34. MVP Scope

The MVP includes:

- PWA;
- local manuscript authoring;
- Quarto Markdown;
- YAML metadata interfaces;
- BibTeX interface;
- IndexedDB persistence;
- browser-side Git;
- GitHub App integration;
- Go BFF;
- repository creation;
- repository selection;
- repository forking;
- OpenDraft initialization;
- pull/push;
- basic PR support;
- OpenDraft RDF vocabulary;
- article SHACL;
- registry SHACL;
- article TTL;
- registry TTL;
- collection registries;
- publication registries;
- human-authored SKOS subjects;
- static publication HTML;
- static publication TTL;
- protocol commit pinning;
- independently verifiable protocol artifacts;
- conformance tests;
- self-documenting protocol manuscript.

---

# 35. Deferred Scope

The following are explicitly deferred:

- JATS;
- advanced PDF production;
- automated semantic annotation;
- centralized search infrastructure;
- centralized publication database;
- centralized metadata authority;
- server-side Git;
- server-side manuscript storage;
- machine-generated CRediT;
- complex peer-review workflows;
- advanced citation graph services;
- cryptographic signing beyond the initial integrity model.

---

# 36. MVP Success Criteria

The MVP is successful when a user can:

1. Open OpenDraft in a browser.
2. Create a manuscript locally.
3. Edit its Quarto source.
4. Edit authors and metadata through forms.
5. Manage references.
6. Save the project locally.
7. Initialize Git.
8. Authorize GitHub.
9. Create a repository.
10. Push the project.
11. Open the repository later.
12. Pull it back into OpenDraft.
13. Fork another OpenDraft repository.
14. Edit the fork.
15. Create a pull request.
16. Merge changes.
17. Publish a version through GitHub Actions.
18. Obtain `article.html`.
19. Obtain `article.ttl`.
20. Validate `article.ttl` using the OpenDraft SHACL.
21. Identify the exact source Git commit.
22. Identify the exact OpenDraft protocol commit.
23. Independently retrieve and verify the protocol artifacts.
24. Register the publication in a publication registry.
25. Discover it through a collection registry.
26. Query its semantic metadata without relying on a central OpenDraft server.

---

# 37. Guiding Architectural Principle

> OpenDraft should make decentralized scholarly publishing easier without making OpenDraft itself a dependency for reading, storing, validating, or discovering publications.

A compliant publication should remain useful with:

- Git;
- RDF tooling;
- SHACL tooling;
- a web browser;
- standard HTTP;
- ordinary static hosting.

The OpenDraft application is a convenience layer and reference implementation, not the authority upon which the publication system depends.
