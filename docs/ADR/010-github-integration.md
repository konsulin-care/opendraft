# ADR 010: GitHub Integration

**Status:** Accepted  
**Date:** 2024-01-01  
**Amended:** 2025-01-01  
**PROPOSAL.md:** §25

## Context

OpenDraft needs to integrate with GitHub for repository hosting and collaboration.

## Decision

GitHub is an integration layer, not the protocol authority.

### User Access Tokens Only

The BFF is the confidential client of the GitHub App and uses **GitHub App user
access tokens only**. These tokens are expiring (8 hours access, ~6 month
refresh) and are refreshed server-side. The browser never receives them.

**Installation tokens and the GitHub App private key are deferred.** The BFF
does not hold or use a private key at runtime. They are introduced only when a
feature genuinely requires them.

### Anonymous Public Reading

Anonymous reading of public repositories happens entirely in the browser
against `api.github.com` and `raw.githubusercontent.com`. Both send CORS `*`,
so the BFF is not involved in the reader path.

### Conversion

Conversion discovers existing manuscripts instead of always scaffolding a fresh
one. The CLI (`opendraft init`) and the web "Convert to OpenDraft" flow share a
single read-only discovery and plan/apply core in `@opendraft/manuscript`.

#### Discovery

- If `opendraft.yml` exists and is valid, it is loaded and registrable folders
  under `manuscripts/*/` that it does not list are reported as **unlisted**;
  they are added only when the user confirms.
- If `opendraft.yml` exists but is invalid (YAML parse error or
  `validateOpendraft` errors), conversion stops and reports the errors. The
  existing file is never rewritten.
- If `opendraft.yml` is missing, immediate subfolders of `manuscripts/` are
  classified as **valid**, **repairable** or **rejected** (see
  `docs/CONVENTION.md`). Files directly under `manuscripts/` are not candidates.

#### Checklist

The web flow shows a checklist of discovered candidates; the CLI registers all
registrable candidates. Registrable means valid or repairable. Repairable
candidates have their missing metadata files created from the shared starter
templates. When no registrable candidate exists, the user supplies a project
name, which is normalized to a manuscript id and scaffolded under
`manuscripts/<id>/`.

#### Plans

Plans only create files. The single permitted update is `opendraft.yml` when it
already exists and is valid: new entries are appended while the protocol block
and existing entries are preserved. `manuscripts/references.bib` is created only
when absent.

#### Register Manuscripts PR

On an already configured repository, a reader banner opens a pull request for
unlisted manuscripts. That PR only updates `opendraft.yml` on branch
`opendraft/register-manuscripts`; it never touches manuscript content.

#### Apply

- If the user has push access **and** the app is installed on the repository:
  create the branch, apply the plan, commit exactly the planned files, push via
  the git relay, and open a pull request via the BFF.
- Otherwise: fork via the BFF, push the branch to the fork, and return a GitHub
  compare URL
  `https://github.com/{owner}/{repo}/compare/{base}...{login}:opendraft/init?expand=1`.

Existing files are never overwritten: a plan's `create` operations fail rather
than replace a file that already exists, and user-authored files are never
edited.

### Flow
- Sign-in obtains a user access token through the BFF.
- The BFF mediates all credential exchange.
- Git operations may be relayed by the BFF for signed-in users only.

## Consequences

- GitHub-specific but not GitHub-dependent.
- Protocol refers to repository resources, not GitHub specifics.
- Secure credential handling via BFF.
- Smallest viable credential surface: no private key or installation tokens.
- Extensible to other Git hosts in future.

## References

- PROPOSAL.md §25
- ADR-011 (BFF Scope)
- ADR-012 (Security Model)
