# Phase 7 — Go BFF

**Summary:** Builds the Go backend-for-frontend that handles confidential GitHub operations, OAuth callbacks, repository creation, secure session management, the git relay, the reader and project conversion, and ships together with the static web app in one Docker image.

---

## OD-070 — Create Go BFF

### Atomic Instruction

Create the Go BFF service at `apps/bff/`.

### Definition of Done

- [x] Service builds as a static/minimal binary. See `Dockerfile` (`CGO_ENABLED=0 go build` into a distroless `static-debian12:nonroot` image) and `apps/bff/go.mod` (standard library only).
- [x] Service exposes `/health`. The health route is `GET /@api/health` under the reserved API namespace; see `apps/bff/internal/httpapi/server.go` and `apps/bff/healthcheck.go`.
- [x] Service starts successfully. See `apps/bff/main.go` (config load, listener, graceful SIGINT/SIGTERM shutdown).
- [x] Service has no database dependency. See `apps/bff/go.mod` and `apps/bff/internal/`; no database package or driver is imported.
- [x] Service has no manuscript storage. Repository content stays in the browser; the BFF only handles GitHub auth, endpoints and the git relay.

---

## OD-071 — Implement GitHub callback

### Atomic Instruction

Implement OAuth callback handling.

### Definition of Done

- [x] Callback validates state. See `apps/bff/internal/httpapi/callback.go` (constant-time state comparison) and `apps/bff/internal/session/oauthtx.go` (sealed transaction cookie).
- [x] Authorization code is exchanged server-side. See `apps/bff/internal/httpapi/callback.go` and `apps/bff/internal/github/oauth.go` (`ExchangeCode` with the PKCE `code_verifier` and client secret).
- [x] Secrets remain server-side. The client secret is only read by `apps/bff/internal/config/config.go` and sent by `apps/bff/internal/github/oauth.go`; see `docs/github-app.md`.
- [x] Invalid state is rejected. See `rejectState` in `apps/bff/internal/httpapi/callback.go`, answering `{"error":"invalid_state"}` without contacting GitHub.

---

## OD-072 — Implement repository creation endpoint

### Atomic Instruction

Implement a narrowly scoped endpoint for repository creation.

### Definition of Done

- [x] Endpoint requires authenticated user authorization. See `handleCreate` in `apps/bff/internal/httpapi/repos.go` wrapped in `requireSession` from `apps/bff/internal/httpapi/session_mw.go`.
- [x] Repository name is validated. See `validateRepoRequest` and `namePattern` in `apps/bff/internal/httpapi/repos.go`.
- [x] Visibility is explicit. The request must name `public` or `private`; see `validateRepoRequest` in `apps/bff/internal/httpapi/repos.go`.
- [x] Organization destination is explicit. The `owner` field is required, validated and passed through; see `validateRepoRequest` and `handleCreate` in `apps/bff/internal/httpapi/repos.go`.
- [x] Arbitrary GitHub API proxying is impossible. Only `POST /@api/repos` with a fixed body shape is registered in `apps/bff/internal/httpapi/server.go`.
- [x] Errors are returned safely. See `writeRepoError` in `apps/bff/internal/httpapi/repos.go`, which maps upstream failures to `{"error":"<code>"}` and never relays an upstream body.

---

## OD-073 — Implement token/session handling

### Atomic Instruction

Implement short-lived secure authentication state.

### Definition of Done

- [x] Tokens are not logged. See the redacting slog handler in `apps/bff/internal/logging/redact.go` and `apps/bff/main.go`; the public session projection in `apps/bff/internal/httpapi/session_mw.go` never carries a token.
- [x] Credentials are not exposed in URLs. Tokens live only inside the AES-256-GCM sealed cookie; see `apps/bff/internal/session/seal.go` and `apps/bff/internal/session/session.go`.
- [x] Cookies/session data use secure attributes where applicable. `__Host-od_session` and `__Host-od_oauth` use `Path=/`, `Secure`, `HttpOnly` and `SameSite=Lax`; see `apps/bff/internal/session/session.go` and `apps/bff/internal/session/oauthtx.go`.
- [x] Expired credentials are rejected. See `expired` in `apps/bff/internal/session/session.go` (7-day absolute lifetime and refresh-token expiry) and `ReadTx` in `apps/bff/internal/session/oauthtx.go` (10-minute transaction).
- [x] Refresh behavior is explicitly defined. Access tokens refresh server-side within 60 seconds of expiry using the refresh token, then the cookie is re-issued; see `requireSession` and `needsRefresh` in `apps/bff/internal/httpapi/session_mw.go` and `Refresh` in `apps/bff/internal/github/oauth.go`.

---

## OD-074 — Benchmark BFF

### Atomic Instruction

Measure BFF resource consumption.

### Definition of Done

- [x] Under representative idle and light-load conditions: CPU target < 0.25 vCPU, RAM target < 30 MB. Measured 0.016 vCPU and 10.8 MB peak under light load; see `docs/benchmarks/bff.md` and `scripts/bench-bff.sh`.
- [x] Any deviation is documented with measurements. No deviation occurred; both targets are met and documented in `docs/benchmarks/bff.md`.

---

## OD-075 — Implement repository action endpoints

### Atomic Instruction

Implement narrow endpoints for repository permissions, pull requests and forks.

### Definition of Done

- [x] Permissions endpoint reports push access, app installation state and default branch. See `GET /@api/repos/{owner}/{repo}/permissions` in `apps/bff/internal/httpapi/repo_actions.go` and `RepoPermissions` in `apps/bff/internal/github/repo_actions.go`.
- [x] Pull request creation is validated and returns the PR number and URL. See `POST /@api/repos/{owner}/{repo}/pulls` and `validatePullRequest` in `apps/bff/internal/httpapi/repo_actions.go`.
- [x] Fork creation returns the fork owner, repository and default branch. See `POST /@api/repos/{owner}/{repo}/forks` in `apps/bff/internal/httpapi/repo_actions.go`.
- [x] Every action endpoint requires a session and same-origin request and answers with the JSON error shape. See `requireSession` in `apps/bff/internal/httpapi/session_mw.go`, `requireSameOrigin` in `apps/bff/internal/httpapi/origin.go` and `writeRepoError` in `apps/bff/internal/httpapi/repos.go`.

---

## OD-076 — Implement git relay

### Atomic Instruction

Relay the smart-HTTP git shapes to GitHub with the signed-in user's token.

### Definition of Done

- [x] Only the three smart-HTTP shapes are forwarded: `GET info/refs?service=git-upload-pack|git-receive-pack`, `POST git-upload-pack` and `POST git-receive-pack`. See `validGitRelayTarget` in `apps/bff/internal/httpapi/gitrelay.go`.
- [x] The relay requires a session and forwards only to the configured GitHub web URL. See `handleRelay` and `newGitRelayHandler` in `apps/bff/internal/httpapi/gitrelay.go`.
- [x] The token is injected as `Authorization: Basic base64("x-access-token:"+token)` and request/response bodies are streamed. See `forward` in `apps/bff/internal/httpapi/gitrelay.go`.
- [x] There is no git logic, unknown targets answer JSON 404 and request bodies are capped at 50 MiB. See `validGitRelayTarget`, `maxGitBodyBytes` and `tooLargeCode` in `apps/bff/internal/httpapi/gitrelay.go`.

---

## OD-077 — Implement the reader page

### Atomic Instruction

Serve the SPA and render GitHub repositories read-only from their public URL shape.

### Definition of Done

- [x] `/{owner}/{repo}` and `/{owner}/{repo}/tree/{ref}` open the draft. See `parseReaderRoute` in `apps/web/src/reader/route.ts` and `ReaderPage` in `apps/web/src/reader/ReaderPage.tsx`.
- [x] Anonymous public repositories load entirely in the browser against `api.github.com` and `raw.githubusercontent.com`; the BFF is not involved. See `apps/web/src/reader/github-public.ts` and `apps/web/src/reader/load-repo.ts`.
- [x] The manuscript uses the read-only block view. See `BlockBody.readonly.test.tsx`, `BlockEditor.readonly.test.tsx` and `apps/web/src/components/ManuscriptView`.
- [x] The SPA is served same-origin: `/@api/*` is reserved for the BFF, `/@assets/*` for Vite assets, root files with a dot are static files and every other path falls back to `index.html`. See `apps/bff/internal/httpapi/static.go` and `apps/bff/internal/httpapi/server.go`.

---

## OD-078 — Implement project conversion

### Atomic Instruction

Convert a repository without `opendraft.yml` into an OpenDraft project without silently modifying the default branch.

### Definition of Done

- [x] The reader detects `opendraft.yml` and distinguishes an OpenDraft repository from a plain repository. See `loadRepo` and `parseManuscripts` in `apps/web/src/reader/load-repo.ts`.
- [x] A plain repository gets an explicit conversion prompt and is never modified silently. See `ConvertPanel` in `apps/web/src/reader/ConvertPanel.tsx` and the conversion branch in `apps/web/src/reader/ReaderPage.tsx`.
- [x] When the user has push access and the app is installed, the scaffold is committed once on `opendraft/init`, pushed through the relay and opened as a pull request via the BFF. See `convertRepository` in `apps/web/src/reader/convert.ts` and `POST /@api/repos/{owner}/{repo}/pulls` in `apps/bff/internal/httpapi/repo_actions.go`.
- [x] Otherwise the repository is forked via the BFF, the branch is pushed to the fork and a GitHub compare URL is returned. See `convertRepository` in `apps/web/src/reader/convert.ts` and `POST /@api/repos/{owner}/{repo}/forks` in `apps/bff/internal/httpapi/repo_actions.go`.
- [x] Initialization is always PR-based, never a direct commit to the default branch. See `CONVERT_BRANCH` and the PR/compare outcomes in `apps/web/src/reader/convert.ts`.

---

## OD-079 — Ship the Docker image

### Atomic Instruction

Build one image that serves the Go BFF and the static web app same-origin.

### Definition of Done

- [x] A multi-stage `Dockerfile` builds the Vite web app and a static Go binary, then copies both into a distroless non-root runtime image.
- [x] The image serves the SPA and the BFF on one origin, with `/@api/*` for the API and `/@assets/*` for hashed assets. See `Dockerfile`, `apps/bff/internal/httpapi/server.go` and `apps/bff/internal/httpapi/static.go`.
- [x] The image exposes port 8080 and a `healthcheck` subcommand that probes `GET /@api/health`. See `Dockerfile` and `apps/bff/healthcheck.go`.
- [x] The runtime image needs no database, manuscript storage or GitHub App private key.

---

## OD-080 — Defer the GitHub App private key

### Atomic Instruction

Document that the BFF runs on GitHub App user access tokens only.

### Definition of Done

- [x] No installation token and no GitHub App private key are used at runtime. See `docs/agents/SECURITY.md`, `docs/ADR/010-github-integration.md` and `docs/github-app.md`.
- [x] The private key is deferred until a feature genuinely needs it; no key is generated, stored in the repository or mounted into the image. See section 5 of `docs/github-app.md`.
- [x] All GitHub calls from the BFF use the signed-in user's access token. See `apps/bff/internal/github/` and `apps/bff/internal/httpapi/session_mw.go`.
