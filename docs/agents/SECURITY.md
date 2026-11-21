# SECURITY.md — Auth, Secrets, Least-Privilege

## Principles

- Least-privilege: request only required permissions.
- No secret exposure: the BFF never exposes tokens, private keys, or cookie
  contents to the browser.
- Narrow surface: the BFF exposes only explicit endpoints, never a generic
  proxy.
- Anonymous reads stay anonymous: public repositories are read directly from
  the browser against GitHub, without OpenDraft credentials.

## Anonymous Mode (No Credentials)

With no GitHub App credentials configured, the BFF exposes no authenticated
surface. It keeps only `/@api/health`, `/@api/auth/session` (reporting
`loginEnabled: false`), and static content; every gated endpoint answers
`403 {"error":"login_disabled"}` and no session key or client secret is needed.

## GitHub Authorization

The BFF is the confidential client of the GitHub App and uses **GitHub App
user access tokens only**. Tokens are expiring (8 hours access, ~6 month
refresh) and are refreshed server-side. The browser never receives them.

**No installation tokens and no private key at runtime.** The GitHub App
private key is deferred until a feature genuinely needs it.

### User Authorization (privileged ops)

Used for operations requiring user consent:

- Repository creation
- Fork to the user account
- Pull requests and permission checks
- Access via the user's OAuth access token

### Anonymous Public Reading

Anonymous reading of public repositories happens entirely in the browser
against `api.github.com` and `raw.githubusercontent.com`. Both send CORS `*`,
so the BFF is not involved in the reader path. No OpenDraft credentials are
attached.

## Session

Sign-in uses OAuth with PKCE (S256) plus a random `state`. The transaction is
stored in the sealed `__Host-od_oauth` cookie (`Max-Age` 600) holding
`{state, verifier, returnTo, exp}`. The callback validates both `state` and the
origin.

The session is an AES-256-GCM sealed cookie:

- Name: `__Host-od_session`
- Attributes: `Path=/`, `Secure`, `HttpOnly`, `SameSite=Lax`
- Absolute lifetime: 7 days
- Current plus previous session key, for key rotation
- Tokens live inside the sealed cookie, never in browser-readable storage

## Git Transport Relay

`/@api/git/{owner}/{repo}.git/...` is **sign-in only** and forwards only the
three smart-HTTP shapes:

- `GET info/refs?service=git-upload-pack`
- `GET info/refs?service=git-receive-pack`
- `POST git-upload-pack`
- `POST git-receive-pack`

The relay forwards to the fixed GitHub web URL, streams bodies, injects
`Authorization: Basic base64("x-access-token:" + token)`, and applies a 50 MiB
body limit. It contains no git logic and never relays upstream response bodies.

## Static Hosting and Reserved Namespace

One Docker image ships the Go BFF plus the static web app, same-origin. The
reserved namespace uses `@`, because it is never a valid GitHub owner (`-` and
`assets` are real accounts):

- BFF endpoints under `/@api/*`
- Vite build assets under `/@assets/*`

Root files whose first path segment contains a dot (`/favicon.ico`, `/sw.js`,
`/manifest.webmanifest`, `/robots.txt`) are static files. Every other path
serves `index.html` (SPA fallback); the web app parses the path, including the
reader routes `/{owner}/{repo}` and `/{owner}/{repo}/tree/{ref}`. Replacing
`github.com` with the publishing host must open the draft.

## BFF Security Constraints

The BFF must never expose:

- GitHub App private keys
- OAuth client secrets
- Access or refresh tokens
- Session or OAuth cookie contents

The BFF must not:

- Proxy arbitrary GitHub API calls
- Relay upstream response bodies
- Store manuscripts or publications
- Keep server-side session storage beyond the sealed cookie

The BFF must log errors with context and never log secrets, tokens, or cookie
values. Errors everywhere use `{"error":"<code>"}`.

## Token Flow

```text
Browser                        BFF                        GitHub
  │                             │                            │
  │── sign in (redirect, PKCE) >│                            │
  │                             │── code + state + secret ──>│
  │                             │<─ access + refresh token ──│
  │<─ __Host-od_session cookie ─│   (tokens stay server-side)│
  │                             │                            │
  │── request + session cookie >│── Bearer user token ──────>│
  │                             │<─ GitHub JSON (narrow) ────│
  │<─ app JSON (never upstream) │                            │
  │                             │                            │
  │── git push/pull + cookie ──>│── Basic x-access-token ───>│
  │<─ smart-HTTP response ──────│<─ smart-HTTP response ─────│
  │                             │                            │
  │── anonymous public read (no cookie, no BFF) ────────────>│
  │<─ api.github.com / raw.githubusercontent.com ────────────│
```

Tokens only travel between the BFF and GitHub. The browser holds only the
opaque sealed session cookie.

## References

- [apps/convention.md](../../apps/convention.md)
- [docs/ADR/010-github-integration.md](../ADR/010-github-integration.md)
- [docs/ADR/011-bff-scope.md](../ADR/011-bff-scope.md)
- [docs/ADR/012-security-model.md](../ADR/012-security-model.md)
