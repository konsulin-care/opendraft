# ADR 011: BFF Scope

**Status:** Accepted  
**Date:** 2024-01-01  
**Amended:** 2024-06-01  
**PROPOSAL.md:** §26

## Context

A backend server is needed for GitHub authentication, but should remain minimal.

## Decision

The BFF exists primarily for secure GitHub auth operations requiring server-side
credentials. One Docker image ships the Go BFF **plus the static web app**,
same-origin, hosted at e.g. `https://publish.konsulin.care`.

Replacing `github.com` with that host must open the draft:

- `/{owner}/{repo}`
- `/{owner}/{repo}/tree/{ref}`

### Session State

The BFF is **minimally stateful** through a sealed-cookie session. Session state
lives in the `__Host-od_session` cookie, not in server-side storage. There is no
database.

### Git Transport Relay

`/@api/git/{owner}/{repo}.git/...` is **sign-in only** and forwards only the
three smart-HTTP shapes:

- `GET info/refs?service=git-upload-pack`
- `GET info/refs?service=git-receive-pack`
- `POST git-upload-pack`
- `POST git-receive-pack`

It streams bodies to the fixed GitHub web URL and adds the user's credential. It
contains **no git logic** and applies a 50 MiB body limit.

### Narrow Endpoints

Only a small, explicit set of endpoints exists. There is never a generic GitHub
proxy. JSON errors everywhere use `{"error":"<code>"}`; upstream bodies are
never relayed.

### Reserved Namespace

The reserved URL namespace uses `@` (never a valid GitHub owner; `-` and
`assets` are real accounts):

- BFF under `/@api/*`
- Vite build assets under `/@assets/*`

Root files whose first path segment contains a dot (`/favicon.ico`, `/sw.js`,
`/manifest.webmanifest`, `/robots.txt`) are static files. Every other path
serves `index.html` (SPA fallback); the web app parses the path.

### Constraints
- Stateless or minimally stateful.
- Lightweight and horizontally replaceable.
- No manuscript storage.
- No publication storage.
- No search databases.
- No background processing (unless later required).

### Resource Targets
- CPU: < 0.25 vCPU under normal workload.
- RAM: < 30 MB.

### Technology
- Go with standard library preferred.

## Consequences

- Easy to deploy and scale.
- One image serves both the BFF and the web app, same-origin.
- No data liability.
- Clear separation: BFF handles auth, client handles everything else.
- Anonymous reading and git logic stay client-side; the relay only forwards.

## References

- PROPOSAL.md §26
- ADR-010 (GitHub Integration)
- ADR-012 (Security Model)
