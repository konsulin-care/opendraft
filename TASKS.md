# OpenDraft — Atomic Implementation Instructions

**Purpose:** Turn the OpenDraft product requirements into independently executable implementation tasks.

Each task should be completed independently where possible. A task is **Done** only when its stated acceptance criteria are satisfied.

---

# Phase 0 — Repository Foundation

## OD-001 — Create OpenDraft monorepo

### Instruction

Create the OpenDraft repository with the initial monorepo structure.

```text
apps/
packages/
protocol/
manuscripts/
templates/
tests/
```

### Definition of Done

- Repository exists.
- Directory structure exists.
- Root README exists.
- Development instructions exist.
- CI can execute successfully.
- No application-specific protocol semantics are embedded outside the protocol package without documentation.

---

## OD-002 — Define OpenDraft namespace

### Instruction

Define the canonical OpenDraft RDF namespace.

### Definition of Done

- Namespace is documented.
- Namespace is used consistently.
- `protocol/opendraft.ttl` uses the namespace.
- Namespace is not GitHub-specific.
- Namespace is documented in the protocol manuscript.

---

## OD-003 — Create `protocol/opendraft.ttl`

### Instruction

Create the initial OpenDraft RDF vocabulary.

### Definition of Done

The ontology defines at minimum:

- project/repository concept;
- manuscript;
- publication;
- publication version;
- registry;
- collection registry;
- publication registry;
- source repository;
- source revision;
- protocol revision;
- subject;
- publication DOI.

The TTL parses successfully with a standard RDF parser.

---

## OD-004 — Create protocol artifact README

### Instruction

Document the purpose and role of the protocol artifacts.

### Definition of Done

README explains:

- `opendraft.ttl`;
- `article.shacl.ttl`;
- `registry.shacl.ttl`;
- `registry.ttl`;
- protocol versioning;
- protocol commit pinning;
- conformance testing.

---

# Phase 1 — Protocol Validation

## OD-010 — Create article SHACL

### Instruction

Create:

```text
protocol/article.shacl.ttl
```

### Definition of Done

The shape validates the minimum valid article representation.

It checks at least:

- publication type;
- title;
- author;
- source repository;
- source revision;
- protocol revision.

A valid fixture passes.

An invalid fixture fails.

---

## OD-011 — Create registry SHACL

### Instruction

Create:

```text
protocol/registry.shacl.ttl
```

### Definition of Done

The shape distinguishes:

```text
collection registry
```

from:

```text
publication registry
```

It rejects a registry that simultaneously contains registries and publications.

---

## OD-012 — Create minimal article fixture

### Instruction

Create a minimal valid:

```text
protocol/examples/article.ttl
```

### Definition of Done

- TTL parses.
- SHACL validation passes.
- Every required property has a clear purpose.
- The example uses the OpenDraft namespace.

---

## OD-013 — Create collection registry fixture

### Instruction

Create:

```text
protocol/registry.ttl
```

as a working collection registry.

### Definition of Done

- It validates.
- It identifies itself.
- It contains at least one registry.
- It does not directly contain publications.
- Its referenced resources are understandable from the example.

---

## OD-014 — Create publication registry fixture

### Instruction

Create an example publication registry.

### Definition of Done

- It validates.
- It contains publications.
- It does not contain registries.
- It demonstrates the expected publication-reference structure.

---

## OD-015 — Create protocol conformance test runner

### Instruction

Implement a test command that validates all protocol fixtures.

### Definition of Done

The command:

```text
PASS
```

when all valid examples pass and invalid examples fail as expected.

The command:

```text
FAIL
```

when a conformance requirement is violated.

---

# Phase 2 — Protocol Versioning and Independent Verification

## OD-020 — Define protocol revision model

### Instruction

Define how a publication records the OpenDraft protocol revision.

### Definition of Done

The model contains:

```text
protocol name
protocol version
protocol repository
protocol commit
```

The full commit SHA is mandatory for immutable provenance.

---

## OD-021 — Define protocol artifact URI convention

### Instruction

Define canonical URI forms for protocol artifacts.

### Definition of Done

The specification distinguishes:

```text
repository at commit
directory at commit
file at commit
```

Example forms are documented.

Mutable branch URLs are explicitly identified as non-immutable references.

---

## OD-022 — Create protocol verification manifest

### Instruction

Define a machine-readable mechanism for independently verifying protocol artifacts.

Initial mechanism:

```text
repository
commit SHA
artifact path
cryptographic hash
```

### Definition of Done

A client can determine:

1. which OpenDraft commit defines the protocol;
2. which artifact is being used;
3. the expected artifact hash;
4. whether the retrieved artifact matches.

---

## OD-023 — Automate protocol artifact verification

### Instruction

Create a GitHub Action that verifies protocol artifacts against their declared commit/hash.

### Definition of Done

CI fails if:

- artifact content changes unexpectedly;
- declared commit is inconsistent;
- declared checksum is inconsistent.

CI passes for the canonical protocol revision.

---

## OD-024 — Pin protocol revision in project template

### Instruction

Make generated OpenDraft projects contain a pinned protocol revision.

### Definition of Done

Generated `opendraft.yml` contains:

```yaml
protocol:
  name: opendraft
  version: ...
  repository: ...
  commit: ...
```

The commit is a full SHA.

---

# Phase 3 — Repository Specification

## OD-030 — Define `opendraft.yml`

### Instruction

Create the first formal `opendraft.yml` schema.

### Definition of Done

Schema defines:

```yaml
protocol:
  name:
  version:
  repository:
  commit:

manuscripts:
  - id:
    path:
```

Unknown fields do not cause failure unless explicitly prohibited by the protocol.

---

## OD-031 — Define manuscript directory convention

### Instruction

Define:

```text
/manuscripts/<id>/
```

### Definition of Done

Specification documents:

- allowed manuscript identifier;
- directory requirements;
- required files;
- optional files;
- relationship to `opendraft.yml`.

---

## OD-032 — Create manuscript template

### Instruction

Create a bootstrap manuscript template.

### Definition of Done

Template contains:

```text
article.qmd
_author.yml
_abstract.yml
_frontmatter.yml
references.bib
```

and a minimal valid Quarto document.

---

## OD-033 — Define metadata file conventions

### Instruction

Define responsibilities of:

```text
_author.yml
_abstract.yml
_frontmatter.yml
_other.yml
```

### Definition of Done

Documentation states what belongs in each file.

No field is duplicated unnecessarily across files.

---

# Phase 4 — Quarto Integration

## OD-040 — Build minimal Quarto manuscript

### Instruction

Create a manuscript using:

```yaml
metadata-files:
  - _author.yml
  - _abstract.yml
  - _frontmatter.yml
  - _other.yml
```

### Definition of Done

Quarto successfully renders the manuscript.

---

## OD-041 — Implement author metadata model

### Instruction

Define the OpenDraft author structure.

### Definition of Done

Model supports:

- name;
- affiliation;
- ORCID;
- corresponding-author designation;
- optional CRediT roles.

---

## OD-042 — Implement metadata compiler

### Instruction

Convert YAML metadata into normalized publication metadata.

### Definition of Done

Compiler produces deterministic output from identical source files.

---

## OD-043 — Implement BibTeX ingestion

### Instruction

Read `references.bib` and expose its references to the semantic compiler.

### Definition of Done

- Valid BibTeX parses.
- DOI is retained where present.
- Citation keys are retained.
- Invalid BibTeX produces a useful error.

---

# Phase 5 — Client Application

## OD-050 — Bootstrap PWA

### Instruction

Create the OpenDraft web application.

### Definition of Done

- Application loads as a static site.
- Application works without the BFF for local editing.
- Application has an application shell.
- Application can run offline after initial load.

---

## OD-051 — Implement IndexedDB workspace

### Instruction

Create local project persistence using IndexedDB.

### Definition of Done

The application can:

- create workspace;
- save files;
- reload after browser restart;
- delete workspace;
- list workspace files.

No manuscript persistence depends on a server.

---

## OD-052 — Implement browser Git repository

### Instruction

Integrate a browser-compatible Git implementation.

### Definition of Done

The client can:

- initialize Git;
- create commit;
- inspect status;
- inspect diff;
- create branch;
- checkout branch.

---

## OD-053 — Implement local manuscript editor

### Instruction

Implement Quarto Markdown editing.

### Definition of Done

User can:

- edit `article.qmd`;
- save changes;
- reopen changes;
- preview Markdown;
- preserve YAML metadata files.

---

## OD-054 — Implement author metadata UI

### Instruction

Create dedicated UI for `_author.yml`.

### Definition of Done

User can:

- add author;
- remove author;
- reorder authors;
- edit author metadata;
- add ORCID;
- designate corresponding author;
- save valid YAML.

---

## OD-055 — Implement abstract metadata UI

### Instruction

Create dedicated UI for `_abstract.yml`.

### Definition of Done

User can edit abstract-related metadata without manually editing YAML.

---

## OD-056 — Implement frontmatter metadata UI

### Instruction

Create dedicated UI for `_frontmatter.yml`.

### Definition of Done

User can edit:

- title;
- keywords;
- subjects;
- funding;
- acknowledgments;
- license;
- relevant dates;
- related resources.

---

## OD-057 — Implement reference UI

### Instruction

Create a reference-management interface for `references.bib`.

### Definition of Done

User can:

- add reference;
- edit reference;
- delete reference;
- inspect DOI;
- search local references;
- save valid BibTeX.

---

# Phase 6 — GitHub Authentication

## OD-060 — Register GitHub App

### Instruction

Create the OpenDraft GitHub App.

### Definition of Done

App has:

- documented permissions;
- configured callback URL;
- secure private key storage;
- development and production configuration separation.

---

## OD-061 — Minimize installation permissions

### Instruction

Request only permissions required for normal repository operation.

### Definition of Done

Permissions are documented and reviewed.

No unnecessary administrative permission is requested for normal operation.

---

## OD-062 — Implement GitHub App installation flow

### Instruction

Allow users to install OpenDraft on selected repositories.

### Definition of Done

User can:

1. start authorization;
2. select account/repositories;
3. return to OpenDraft;
4. identify the installation;
5. access authorized repository operations.

---

## OD-063 — Implement GitHub App user authorization

### Instruction

Implement user authorization for operations that require acting as the user.

### Definition of Done

User can authorize OpenDraft through GitHub.

Authorization code exchange occurs through the BFF.

Client secrets/private keys never reach the browser.

---

# Phase 7 — Go BFF

## OD-070 — Create Go BFF

### Instruction

Create:

```text
apps/bff/
```

### Definition of Done

Service:

- builds as a static/minimal binary;
- exposes `/health`;
- starts successfully;
- has no database dependency;
- has no manuscript storage.

---

## OD-071 — Implement GitHub callback

### Instruction

Implement OAuth callback handling.

### Definition of Done

- callback validates state;
- authorization code is exchanged server-side;
- secrets remain server-side;
- invalid state is rejected.

---

## OD-072 — Implement repository creation endpoint

### Instruction

Implement a narrowly scoped endpoint for repository creation.

### Definition of Done

- Endpoint requires authenticated user authorization.
- Repository name is validated.
- Visibility is explicit.
- Organization destination is explicit.
- Arbitrary GitHub API proxying is impossible.
- Errors are returned safely.

---

## OD-073 — Implement token/session handling

### Instruction

Implement short-lived secure authentication state.

### Definition of Done

- tokens are not logged;
- credentials are not exposed in URLs;
- cookies/session data use secure attributes where applicable;
- expired credentials are rejected;
- refresh behavior is explicitly defined.

---

## OD-074 — Benchmark BFF

### Instruction

Measure BFF resource consumption.

### Definition of Done

Under representative idle and light-load conditions:

```text
CPU target: < 0.25 vCPU
RAM target: < 30 MB
```

Any deviation is documented with measurements.

---

# Phase 8 — New Repository Workflow

## OD-080 — Implement local project creation

### Instruction

Allow a user to create a project locally.

### Definition of Done

Application creates:

```text
opendraft.yml
manuscripts/
.github/workflows/
```

and a manuscript template.

---

## OD-081 — Implement local Git initialization

### Instruction

Initialize the new project as Git.

### Definition of Done

A valid initial commit can be created locally.

---

## OD-082 — Implement repository creation UI

### Instruction

Allow user to choose:

- repository name;
- personal account;
- organization;
- visibility.

### Definition of Done

Selection is passed to the BFF only when required.

---

## OD-083 — Implement initial push

### Instruction

Push the local repository to GitHub.

### Definition of Done

A newly created GitHub repository contains the complete local project.

---

# Phase 9 — Existing Repository Workflow

## OD-090 — Implement repository listing

### Instruction

Display repositories available through the authorized GitHub App installation.

### Definition of Done

User can select a repository they are authorized to access.

---

## OD-091 — Implement repository clone/fetch

### Instruction

Fetch repository contents into IndexedDB.

### Definition of Done

Repository can be loaded without server-side manuscript storage.

---

## OD-092 — Implement `opendraft.yml` detection

### Instruction

Inspect the repository root after cloning.

### Definition of Done

Application distinguishes:

```text
OpenDraft repository
non-OpenDraft repository
```

---

## OD-093 — Implement safe initialization prompt

### Instruction

If `opendraft.yml` is absent, offer initialization.

### Definition of Done

Application never silently modifies an unrecognized repository.

---

## OD-094 — Implement repository initialization

### Instruction

Add OpenDraft structure to an existing repository.

### Definition of Done

Initialization preserves existing files and creates only required OpenDraft files.

Initialization produces one clear Git commit.

---

# Phase 10 — Fork Workflow

## OD-100 — Implement repository URL input

### Instruction

Allow user to enter a source repository URL.

### Definition of Done

Application validates supported repository URL forms.

---

## OD-101 — Implement GitHub fork operation

### Instruction

Fork the repository to a user-selected destination.

### Definition of Done

User can select:

- personal account;
- permitted organization.

Fork is created successfully.

---

## OD-102 — Load fork into local workspace

### Instruction

Clone/fetch the newly created fork.

### Definition of Done

Fork appears as an independent local workspace.

---

## OD-103 — Preserve protocol provenance after fork

### Instruction

Ensure forking does not modify the protocol authority.

### Definition of Done

The project retains the original pinned OpenDraft protocol commit.

---

# Phase 11 — Git Collaboration

## OD-110 — Implement commit interface

### Instruction

Provide user-facing Git commit functionality.

### Definition of Done

User can:

- inspect changes;
- enter commit message;
- commit;
- inspect resulting SHA.

---

## OD-111 — Implement push/sync

### Instruction

Implement synchronization with the remote repository.

### Definition of Done

User can push local commits.

Push failures provide actionable errors.

---

## OD-112 — Implement pull/sync

### Instruction

Implement remote synchronization.

### Definition of Done

Application detects divergent history before destructive operations.

---

## OD-113 — Implement branch creation

### Instruction

Allow branch creation from the UI.

### Definition of Done

User can create and switch branches locally.

---

## OD-114 — Implement pull request creation

### Instruction

Allow users to open a PR.

### Definition of Done

User can select:

- source branch;
- target branch;
- title;
- description.

PR URL is returned.

---

# Phase 12 — Semantic Compiler

## OD-120 — Implement article RDF compiler

### Instruction

Compile manuscript source into `article.ttl`.

### Definition of Done

Compiler represents at minimum:

- publication;
- DOI when available;
- title;
- authors;
- abstract;
- subjects;
- keywords;
- references;
- repository;
- manuscript path;
- source commit;
- protocol revision.

---

## OD-121 — Ensure deterministic RDF

### Instruction

Make RDF generation deterministic.

### Definition of Done

Identical source and build inputs produce equivalent deterministic output.

---

## OD-122 — Record source commit

### Instruction

Inject the exact source Git commit into `article.ttl`.

### Definition of Done

Published TTL identifies the exact source revision.

No mutable branch name is used as the immutable source identity.

---

## OD-123 — Record protocol commit

### Instruction

Inject the pinned OpenDraft protocol commit into `article.ttl`.

### Definition of Done

Published TTL identifies the exact OpenDraft protocol revision used during compilation.

---

## OD-124 — Validate generated article RDF

### Instruction

Run article SHACL validation after RDF compilation.

### Definition of Done

Publication fails if generated RDF violates the protocol.

---

# Phase 13 — Registry Implementation

## OD-130 — Implement registry RDF model

### Instruction

Implement collection and publication registry semantics.

### Definition of Done

Registry RDF can unambiguously indicate:

```text
collection registry
```

or:

```text
publication registry
```

---

## OD-131 — Implement registry validation

### Instruction

Validate registries with SHACL.

### Definition of Done

Mixed registry contents are rejected.

---

## OD-132 — Implement registry subject metadata

### Instruction

Allow human-authored SKOS subjects on registries.

### Definition of Done

A registry can declare semantic themes used for discovery.

---

## OD-133 — Implement publication registration

### Instruction

Allow a publication registry to contain article references.

### Definition of Done

A valid publication registry can reference `article.ttl`.

---

## OD-134 — Implement collection registration

### Instruction

Allow a collection registry to contain registry references.

### Definition of Done

A valid collection registry can reference child registries.

---

# Phase 14 — Discovery

## OD-140 — Implement registry loading

### Instruction

Allow OpenDraft to load a remote `registry.ttl`.

### Definition of Done

Client can retrieve and parse a registry from a static URL.

---

## OD-141 — Implement registry type detection

### Instruction

Determine whether loaded registry is a collection or publication registry.

### Definition of Done

Client correctly routes the resource according to its RDF type.

---

## OD-142 — Implement subject filtering

### Instruction

Allow users to filter registries by SKOS subject.

### Definition of Done

Client can select a subject and remove irrelevant registry branches before downloading publications.

---

## OD-143 — Implement recursive registry traversal

### Instruction

Traverse collection registries recursively.

### Definition of Done

Client can:

```text
registry
  → registry
  → registry
  → publication registry
```

without requiring a central server.

---

## OD-144 — Implement selective publication retrieval

### Instruction

Allow users to select individual publications from a publication registry.

### Definition of Done

Client downloads only selected `article.ttl` resources.

---

# Phase 15 — Protocol Documentation

## OD-150 — Create protocol manuscript

### Instruction

Create:

```text
manuscripts/distributed-scientific-publication/
```

### Definition of Done

It contains:

```text
article.qmd
_author.yml
_abstract.yml
_frontmatter.yml
references.bib
```

and explains the OpenDraft protocol.

---

## OD-151 — Publish protocol manuscript using OpenDraft

### Instruction

Use OpenDraft's own publication pipeline to compile the protocol manuscript.

### Definition of Done

The OpenDraft repository can generate:

```text
article.html
article.ttl
```

for its own protocol manuscript.

---

## OD-152 — Ensure protocol documentation is self-consistent

### Instruction

Ensure the protocol manuscript describes the same protocol represented by `protocol/opendraft.ttl`.

### Definition of Done

- terminology is consistent;
- RDF vocabulary names are consistent;
- registry semantics are consistent;
- identity model is consistent;
- versioning model is consistent.

---

# Phase 16 — GitHub Actions

## OD-160 — Create validation workflow

### Instruction

Create the repository GitHub Action responsible for OpenDraft validation.

### Definition of Done

Workflow:

1. checks out source;
2. validates project structure;
3. validates metadata;
4. validates references;
5. compiles RDF;
6. validates RDF with SHACL.

---

## OD-161 — Pin OpenDraft protocol checkout

### Instruction

Make the workflow retrieve the OpenDraft protocol at an immutable commit.

### Definition of Done

Workflow never retrieves the protocol solely from `main`.

The exact protocol SHA is visible in build logs/artifacts.

---

## OD-162 — Create publication workflow

### Instruction

Create the publication build workflow.

### Definition of Done

Successful build produces:

```text
article.html
article.ttl
```

and publishes them to the configured static hosting destination.

---

## OD-163 — Verify protocol artifacts during CI

### Instruction

Verify the protocol artifacts used by the build.

### Definition of Done

Build fails when:

- protocol commit is unavailable;
- protocol artifact is altered;
- artifact hash does not match;
- protocol validation fails.

---

# Phase 17 — Static Publication

## OD-170 — Publish HTML

### Instruction

Deploy Quarto-generated HTML as a static site.

### Definition of Done

Publication is readable without OpenDraft.

---

## OD-171 — Publish TTL

### Instruction

Expose `article.ttl` as a static resource.

### Definition of Done

The TTL can be retrieved directly over HTTP.

---

## OD-172 — Publish provenance

### Instruction

Ensure the static publication exposes provenance metadata.

### Definition of Done

The article TTL identifies:

```text
DOI
repository
manuscript
source commit
protocol version
protocol commit
```

---

# Phase 18 — DOI Integration

## OD-180 — Define DOI release boundary

### Instruction

Define exactly when a Git version becomes a DOI-bearing publication.

### Definition of Done

Documentation specifies:

- candidate release;
- validation;
- publication;
- DOI minting;
- immutable release state.

---

## OD-181 — Integrate Zenodo

### Instruction

Implement DOI minting through Zenodo for the MVP.

### Definition of Done

A publication release can create a DOI.

The DOI is injected into the publication metadata before or during final publication according to the selected release workflow.

---

## OD-182 — Preserve DOI version identity

### Instruction

Ensure each publication version can be distinguished.

### Definition of Done

Different released versions have distinct DOI identities where required by the publication policy.

---

# Phase 19 — Security

## OD-190 — Audit GitHub permissions

### Instruction

Review all GitHub App permissions.

### Definition of Done

Every permission has documented justification.

Unneeded permissions are removed.

---

## OD-191 — Audit BFF secrets

### Instruction

Audit secret handling.

### Definition of Done

No private key, client secret, refresh token, or equivalent credential appears in:

- browser source;
- Git repository;
- logs;
- URLs;
- error responses.

---

## OD-192 — Audit repository initialization

### Instruction

Ensure initialization cannot unintentionally destroy repository content.

### Definition of Done

Existing files are preserved.

Changes are reviewable.

Initialization is explicit.

---

## OD-193 — Audit arbitrary API access

### Instruction

Verify the BFF does not expose a generic GitHub proxy.

### Definition of Done

Only explicitly implemented operations are available.

---

# Phase 20 — Performance

## OD-200 — Measure PWA startup

### Instruction

Measure application startup with a representative manuscript.

### Definition of Done

Measurements are recorded for:

- initial load;
- workspace load;
- Git repository load;
- manuscript load.

---

## OD-201 — Measure IndexedDB workspace

### Instruction

Measure local persistence with:

- one manuscript;
- multiple manuscripts;
- references;
- images.

### Definition of Done

Performance limitations are documented.

---

## OD-202 — Measure BFF memory

### Instruction

Measure Go BFF memory usage.

### Definition of Done

Normal operation is below:

```text
30 MB RAM
```

or an explicit exception is documented.

---

## OD-203 — Measure BFF CPU

### Instruction

Measure CPU under representative authentication/API load.

### Definition of Done

Normal workload stays below:

```text
0.25 vCPU
```

or an explicit exception is documented.

---

# Phase 21 — End-to-End Conformance

## OD-210 — New-project end-to-end test

### Instruction

Test:

```text
new local manuscript
→ Git
→ GitHub repository
→ GitHub Action
→ article.html
→ article.ttl
```

### Definition of Done

The complete workflow succeeds without manually editing generated artifacts.

---

## OD-211 — Existing-repository end-to-end test

### Instruction

Test:

```text
existing repository
→ authorize
→ select
→ clone
→ initialize
→ edit
→ push
```

### Definition of Done

Workflow succeeds without server-side manuscript storage.

---

## OD-212 — Fork end-to-end test

### Instruction

Test:

```text
source repository
→ fork
→ clone
→ edit
→ commit
→ push
→ PR
```

### Definition of Done

Workflow succeeds.

Protocol provenance remains pinned to the original protocol revision.

---

## OD-213 — Registry discovery end-to-end test

### Instruction

Create:

```text
collection registry
    ↓
publication registry
    ↓
article.ttl
```

### Definition of Done

Client can traverse the hierarchy and retrieve the publication.

---

## OD-214 — Independent protocol verification test

### Instruction

Verify a publication without using OpenDraft.

Use:

- ordinary HTTP;
- an RDF parser;
- a SHACL validator.

### Definition of Done

A third-party tool can:

1. retrieve `article.ttl`;
2. identify its protocol revision;
3. retrieve the protocol artifact;
4. verify its integrity;
5. validate the article.

---

# Phase 22 — MVP Release Gate

## OD-220 — Protocol release candidate

### Instruction

Freeze the first protocol version.

### Definition of Done

All protocol tests pass.

Protocol artifacts are immutable at a known commit.

---

## OD-221 — OpenDraft release candidate

### Instruction

Freeze the first OpenDraft MVP.

### Definition of Done

All critical end-to-end workflows pass.

---

## OD-222 — Self-hosting verification

### Instruction

Verify that OpenDraft's own protocol manuscript is itself processed by OpenDraft.

### Definition of Done

The OpenDraft repository successfully publishes its own protocol documentation as:

```text
HTML
TTL
```

---

## OD-223 — Decentralization verification

### Instruction

Test publication consumption without the OpenDraft application or BFF.

### Definition of Done

A user can retrieve and understand a publication using:

- browser;
- HTTP;
- RDF parser;
- SHACL validator.

No OpenDraft server is required.

---

# Final Definition of Done

The OpenDraft MVP is considered complete only when all of the following are true:

- [ ] OpenDraft runs as a client-first PWA.
- [ ] Manuscripts can be drafted offline.
- [ ] Local persistence uses IndexedDB.
- [ ] Git operations work client-side.
- [ ] Existing GitHub repositories can be opened.
- [ ] GitHub repositories can be forked.
- [ ] New GitHub repositories can be created.
- [ ] GitHub App permissions follow least privilege.
- [ ] Privileged user authorization is separated from normal repository installation authorization.
- [ ] Go BFF handles confidential GitHub operations.
- [ ] BFF meets the agreed resource target under representative load.
- [ ] Existing repositories can be initialized without destroying content.
- [ ] `opendraft.yml` identifies OpenDraft integration.
- [ ] Multiple manuscripts can exist in one repository.
- [ ] Quarto Markdown is the primary manuscript format.
- [ ] YAML metadata is separated into dedicated files.
- [ ] Author metadata has a dedicated UI.
- [ ] References have a dedicated UI.
- [ ] CRediT is declarative rather than automatically inferred.
- [ ] Git activity is retained as audit evidence.
- [ ] Human-authored SKOS subjects are supported.
- [ ] Article RDF is generated automatically.
- [ ] Article RDF is SHACL-validated.
- [ ] Registry RDF is SHACL-validated.
- [ ] Collection registries and publication registries are mutually exclusive.
- [ ] Static `registry.ttl` is supported.
- [ ] Static `article.ttl` is supported.
- [ ] Static `article.html` is supported.
- [ ] Registry discovery works hierarchically.
- [ ] Publication discovery can be narrowed using semantic subjects.
- [ ] No central publication database is required.
- [ ] A central registry is optional.
- [ ] A user can choose an arbitrary registry as a discovery root.
- [ ] Publication provenance records the source Git commit.
- [ ] Publication provenance records the OpenDraft protocol commit.
- [ ] Protocol artifacts are independently verifiable.
- [ ] Protocol artifacts are versioned by immutable Git commit.
- [ ] `protocol/opendraft.ttl` is the canonical vocabulary artifact.
- [ ] `protocol/registry.ttl` is a working collection-registry example.
- [ ] The OpenDraft protocol documentation is itself an OpenDraft manuscript.
- [ ] OpenDraft can publish its own protocol manuscript.
- [ ] The publication can be validated without the OpenDraft application.
- [ ] The publication can be retrieved without an OpenDraft server.
- [ ] The protocol can be implemented by software other than OpenDraft.
- [ ] JATS is not required for the MVP.
- [ ] PDF/Typst is not required for the MVP.
- [ ] Automated semantic annotation is not required for the MVP.
