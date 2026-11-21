# ADR 010: GitHub Integration

**Status:** Accepted  
**Date:** 2024-01-01  
**Amended:** 2024-06-01  
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

A repository without `opendraft.yml` can be converted:

- If the user has push access **and** the app is installed on the repository:
  create branch `opendraft/init`, scaffold, commit, push via the git relay, and
  open a pull request via the BFF.
- Otherwise: fork via the BFF, push the branch to the fork, and return a GitHub
  compare URL
  `https://github.com/{owner}/{repo}/compare/{base}...{login}:opendraft/init?expand=1`.

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
