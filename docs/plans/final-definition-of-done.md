# Final Definition of Done — OpenDraft MVP

The OpenDraft MVP is considered complete only when all of the following are true.

---

## Client-First Architecture

- [ ] OpenDraft runs as a client-first PWA.
- [ ] Manuscripts can be drafted offline.
- [ ] Local persistence uses IndexedDB.
- [ ] Git operations work client-side.

## Repository Workflows

- [ ] Existing GitHub repositories can be opened.
- [ ] GitHub repositories can be forked.
- [ ] New GitHub repositories can be created.
- [ ] Existing repositories can be initialized without destroying content.

## Authentication and BFF

- [ ] GitHub App permissions follow least privilege.
- [ ] Privileged user authorization is separated from normal repository installation authorization.
- [ ] Go BFF handles confidential GitHub operations.
- [ ] BFF meets the agreed resource target under representative load.

## Project Structure

- [ ] `opendraft.yml` identifies OpenDraft integration.
- [ ] Multiple manuscripts can exist in one repository.

## Manuscript Format

- [ ] Quarto Markdown is the primary manuscript format.
- [ ] YAML metadata is separated into dedicated files.
- [ ] Author metadata has a dedicated UI.
- [ ] References have a dedicated UI.
- [ ] CRediT is declarative rather than automatically inferred.

## Git and Audit

- [ ] Git activity is retained as audit evidence.

## Semantic Web

- [ ] Human-authored SKOS subjects are supported.
- [ ] Article RDF is generated automatically.
- [ ] Article RDF is SHACL-validated.
- [ ] Registry RDF is SHACL-validated.
- [ ] Collection registries and publication registries are mutually exclusive.

## Static Publication

- [ ] Static `registry.ttl` is supported.
- [ ] Static `article.ttl` is supported.
- [ ] Static `article.html` is supported.

## Discovery

- [ ] Registry discovery works hierarchically.
- [ ] Publication discovery can be narrowed using semantic subjects.
- [ ] No central publication database is required.
- [ ] A central registry is optional.
- [ ] A user can choose an arbitrary registry as a discovery root.

## Provenance

- [ ] Publication provenance records the source Git commit.
- [ ] Publication provenance records the OpenDraft protocol commit.

## Protocol Verification

- [ ] Protocol artifacts are independently verifiable.
- [ ] Protocol artifacts are versioned by immutable Git commit.
- [ ] `protocol/opendraft.ttl` is the canonical vocabulary artifact.
- [ ] `protocol/registry.ttl` is a working collection-registry example.

## Self-Hosting

- [ ] The OpenDraft protocol documentation is itself an OpenDraft manuscript.
- [ ] OpenDraft can publish its own protocol manuscript.

## Independence

- [ ] The publication can be validated without the OpenDraft application.
- [ ] The publication can be retrieved without an OpenDraft server.
- [ ] The protocol can be implemented by software other than OpenDraft.

## MVP Exclusions (Not Required)

- [ ] JATS is not required for the MVP.
- [ ] PDF/Typst is not required for the MVP.
- [ ] Automated semantic annotation is not required for the MVP.
