# ADR 012: Security Model

**Status:** Accepted  
**Date:** 2024-01-01  
**Amended:** 2024-06-01  
**PROPOSAL.md:** §27

## Context

OpenDraft handles GitHub credentials and user authentication. Security must
follow best practices.

## Decision

### Least-Privilege Principles
- GitHub App requests only required permissions.
- The browser receives only credentials necessary for operation.

### Tokens Never Reach the Browser

The BFF is the confidential client of the GitHub App. Tokens (access and
refresh) are held server-side in a sealed cookie session and are never exposed
to browser JavaScript, responses, or URLs. Anonymous public reading goes
directly from the browser to GitHub APIs and carries no OpenDraft credentials.

### OAuth Transaction

The sign-in flow uses **PKCE (S256) plus a random `state`**. The transaction is
stored in the sealed `__Host-od_oauth` cookie (`Max-Age` 600), holding
`{state, verifier, returnTo, exp}`. The callback validates both `state` and the
origin.

### Session Cookie

Session state is an AES-256-GCM sealed cookie:

- Name: `__Host-od_session`
- Attributes: `Path=/`, `Secure`, `HttpOnly`, `SameSite=Lax`
- Absolute lifetime: 7 days
- Current and previous session key support rotation

### Request Protections

- Origin check on state-changing requests.
- Log redaction: never log secrets, tokens, or cookie values.
- JSON errors use `{"error":"<code>"}`; upstream bodies are never relayed.

### BFF Constraints
Must never expose:
- GitHub App private keys.
- OAuth client secrets.
- Refresh tokens unnecessarily.
- Installation private credentials.

Must not:
- Provide arbitrary GitHub API proxying.
- Relay upstream response bodies.

## Consequences

- Reduced attack surface.
- Explicit permission model.
- Clear trust boundaries.
- Credentials never reach the browser.

## References

- PROPOSAL.md §27
- ADR-010 (GitHub Integration)
- ADR-011 (BFF Scope)
