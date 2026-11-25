# GitHub App registration runbook

This runbook describes how to register the two OpenDraft GitHub Apps, configure
their permissions and secrets, and rotate credentials. OpenDraft uses GitHub App
**user access tokens** only. The BFF is the confidential client and keeps every
credential server-side; no token or secret reaches the browser.

Register two separate apps:

| Environment | Suggested name | Public origin |
|-------------|----------------|---------------|
| Production  | `OpenDraft` | `https://publish.konsulin.care` |
| Development | `OpenDraft Dev` | `http://127.0.0.1:5173` (or `https://<host>.ts.net` on a Tailscale dev box) |

Register at `https://github.com/settings/apps/new` while signed in as the owning
account or organization.

## Run locally without a GitHub App

A GitHub App is optional. With none of `BFF_GITHUB_CLIENT_ID`,
`BFF_GITHUB_CLIENT_SECRET` (or `_FILE`), or `BFF_GITHUB_APP_SLUG` set, the BFF
starts in **anonymous read-only mode**: no secrets are needed, no session key is
required, and the reader still works because the browser reads public
repositories directly from `api.github.com` and `raw.githubusercontent.com`.

Setting only some of the three variables is a startup error that names the
missing ones. Once all three are set, `BFF_SESSION_KEY` becomes required.

Anonymous mode makes the following features unavailable:

- Sign-in
- Repository creation
- Conversion (pull requests)
- Git transport relay

The gated endpoints answer `403 {"error":"login_disabled"}`:
`/@api/auth/login`, `/@api/auth/install`, `/@api/auth/callback`,
`POST /@api/auth/logout`, `POST /@api/repos`, `/@api/repos/{owner}/{repo}/...`,
and `/@api/git/...`.

Unaffected are `/@api/health`, static files and the SPA fallback, and
`/@api/auth/session`, which answers `200 {"loginEnabled":false}` so the web app
knows login is off.

## 1. Basic information

Set the following for each app.

| Field | Production | Development |
|-------|------------|-------------|
| GitHub App name | `OpenDraft` | `OpenDraft Dev` |
| Homepage URL | `https://publish.konsulin.care` | `http://127.0.0.1:5173` or `https://<host>.ts.net` |
| Callback URL | `https://publish.konsulin.care/@api/auth/callback` | `http://127.0.0.1:5173/@api/auth/callback` or `https://<host>.ts.net/@api/auth/callback` |
| Setup URL | `https://publish.konsulin.care/@api/auth/install/callback` | `http://127.0.0.1:5173/@api/auth/install/callback` or `https://<host>.ts.net/@api/auth/install/callback` |

The callback URL is always `BFF_PUBLIC_ORIGIN` + `/@api/auth/callback`. The
setup URL is always `BFF_PUBLIC_ORIGIN` + `/@api/auth/install/callback`. Both
must match the deployed `BFF_PUBLIC_ORIGIN` exactly, including scheme and port.

OpenDraft does not rely on GitHub's "Request user authorization (OAuth) during
installation" option. The installation flow is driven by the BFF instead:
`/@api/auth/install` stores the pending `returnTo` in the sealed transaction
cookie and redirects to the app install page. After installation GitHub sends
the user to the setup URL, and the BFF redirects them to `returnTo` when a
session exists, or to `/@api/auth/login?return_to=<returnTo>` otherwise.

Under **Identifying and authorizing users**:

- **Request user authorization (OAuth) during installation**: OFF. The BFF
  starts authorization explicitly after the install callback.
- **Expire user authorization tokens**: ON (8-hour access tokens with a
  ~6-month refresh token; the BFF refreshes them server-side)
- **Enable Device Flow**: OFF

Under **Post installation**:

- **Setup URL**: `BFF_PUBLIC_ORIGIN` + `/@api/auth/install/callback` (for
  example `https://publish.konsulin.care/@api/auth/install/callback` on
  production). This handler ignores the spoofable `installation_id` query
  parameter and only uses the sealed `returnTo` cookie.
- **Redirect on update**: ON. Reinstalls and permission changes must come back
  through the setup URL so the flow can resume.

Under **Webhook**:

- **Active**: OFF. OpenDraft does not consume webhooks.

Under **Visibility**:

- **Public**: the app must be public so any GitHub user can install it. Private
  apps only install on the owner's account.

## 2. Repository permissions

Request the minimum set required for normal operation. Do **not** grant account
(organization or user) permissions; OpenDraft never needs them.

| Permission | Access | Why |
|------------|--------|-----|
| Metadata | Read | Implied by every app; required for repository lookup. |
| Contents | Read/write | Read manuscripts, scaffold `opendraft.yml`, push `opendraft/init`. |
| Pull requests | Read/write | Open and update the conversion pull request. |
| Workflows | Read/write | Commit workflow files without being rejected by GitHub. |
| Administration | Read/write | Repository creation for new drafts. Grant the narrower **repository creation** option instead whenever GitHub offers it. |

Leave every other permission at **No access**, including all organization and
user permissions (members, emails, administration, etc.). The app never asks
for installation tokens at runtime: the optional private key (see section 5) is
only used to mint short-lived app JWTs for repo-level installation lookups.

## 3. Client secret

After creating the app, generate a client secret on the app's settings page and
store it as a deployment secret on the BFF host. Provide it either as
`BFF_GITHUB_CLIENT_SECRET` or, preferably, via a file path in
`BFF_GITHUB_CLIENT_SECRET_FILE` (for example a Docker or systemd secret mounted
at `/run/secrets/github_client_secret`). The BFF reads the file at startup.

Never commit the secret, bake it into an image, or expose it to the web app. The
browser only sees the OAuth redirect; the code exchange and token refresh happen
in the BFF.

### Client secret rotation

GitHub allows two concurrent client secrets per app. Rotate without downtime:

1. On the GitHub App settings page, generate a **second** client secret. Both
   secrets are now valid.
2. Update the deployment secret (`BFF_GITHUB_CLIENT_SECRET_FILE`) to the new
   value and redeploy/restart the BFF.
3. Confirm users can still sign in and refresh tokens.
4. Delete the old client secret on GitHub.

## 4. Session key

The session cookie (`__Host-od_session`) is sealed with AES-256-GCM using a
32-byte key. Generate one with:

```bash
openssl rand -base64 32
```

Store the output as `BFF_SESSION_KEY` or, preferably, as a file referenced by
`BFF_SESSION_KEY_FILE`. The value must decode to exactly 32 bytes.

### Session key rotation

The BFF opens cookies with the current key and falls back to
`BFF_SESSION_KEY_PREVIOUS`, so existing 7-day sessions survive a rotation:

1. Generate a new key with `openssl rand -base64 32`.
2. Move the current key into `BFF_SESSION_KEY_PREVIOUS`.
3. Set `BFF_SESSION_KEY` (or `BFF_SESSION_KEY_FILE`) to the new key.
4. Restart the BFF. New cookies use the new key; old cookies are still accepted.
5. After the maximum session lifetime (7 days) plus clock skew, clear
   `BFF_SESSION_KEY_PREVIOUS` and restart.

## 5. App private key (optional)

OpenDraft can optionally use a GitHub App private key to check whether the app
is installed on a specific repository. It is **not** used for installation
tokens: runtime operations still use GitHub App **user access tokens**.

### Why it exists

The BFF reports `installed` from `GET /user/installations` with the signed-in
user's token. That endpoint only lists installations the user has explicit
access to, so an outside contributor who opens a draft in an organization they
do not belong to sees "The owners haven't enabled OpenDraft on this
repository" even though the app is installed there.

With a private key the BFF mints an RS256 app JWT and calls
`GET /repos/{owner}/{repo}/installation`: `200` means installed, `404` means not
installed. The JWT's `iss` is the app's **client ID** (`BFF_GITHUB_CLIENT_ID`),
so no separate App ID is needed. `/user/installations` is still read (across
pages) for `viewerInstalledAll`. Without a key the BFF keeps the user-token-only
behaviour.

### Generate and store the key

1. Open the GitHub App settings, go to **Credentials > Key pairs > New key** and
   download the generated `.pem` (PKCS#1, `BEGIN RSA PRIVATE KEY`).
2. Store it in the BFF deployment as `BFF_GITHUB_APP_PRIVATE_KEY`, the raw PEM
   including the `BEGIN`/`END` lines. In Coolify add the variable with
   **Value type: Multiline** and **Interpolation: Literal**, so the newlines and
   `$` characters survive. Literal `\n` escapes are also accepted.
3. Never commit the key, bake it into an image, or expose it to the browser.
   GitHub stores only the public half.

Without a key the BFF keeps today's behaviour: repo installation checks rely on
`/user/installations` with the user's token.

### Key rotation

GitHub allows up to 25 keys per app. Rotate without downtime:

1. On the GitHub App settings page, generate a **new** key. Both keys are now
   valid.
2. Update `BFF_GITHUB_APP_PRIVATE_KEY` to the new PEM and redeploy/restart the
   BFF.
3. Confirm repo installation checks still work for outside contributors.
4. Delete the old key on GitHub.

## 6. Wiring the apps into the BFF

Set the deployment environment from the app's settings page.

| Variable | Value |
|----------|-------|
| `BFF_PUBLIC_ORIGIN` | `https://publish.konsulin.care` (prod) / dev origin |
| `BFF_GITHUB_CLIENT_ID` | The app's client ID |
| `BFF_GITHUB_CLIENT_SECRET_FILE` | Path to the mounted client secret |
| `BFF_GITHUB_APP_SLUG` | The app slug, e.g. `opendraft` / `opendraft-dev` |
| `BFF_GITHUB_APP_PRIVATE_KEY` | Optional raw PEM app private key (Multiline + Literal in Coolify); omit to keep user-token-only installation checks |
| `BFF_SESSION_KEY_FILE` | Path to the mounted 32-byte session key |
| `BFF_SESSION_KEY_PREVIOUS` | Optional previous key during rotation |

The BFF derives the callback URL as `BFF_PUBLIC_ORIGIN` + `/@api/auth/callback`
and must match the value registered above.

## 7. User entry points

- Sign in: `/#/…` triggers `GET /@api/auth/login`, which starts the OAuth flow
  with state, PKCE (S256), and the client secret.
- Install: users start the installation from `/@api/auth/install`, which stores
  the pending `returnTo` in the sealed transaction cookie and redirects to the
  GitHub App installation page. After selecting an account and repositories
  GitHub returns to `/@api/auth/install/callback`; that handler ignores the
  spoofable `installation_id` and redirects to `returnTo` when a session
exists, or to `/@api/auth/login?return_to=<returnTo>` otherwise.
- Sign out: `POST /@api/auth/logout` drops the session cookie.

## 8. Suggest edits (editable reader)

The reader at `/{owner}/{repo}` is editable by any signed-in GitHub user. The
web app never says fork, branch, or pull request: it offers "Suggest edits",
"Save to my copy", "Submit suggestion", and "Update suggestion". Every
suggestion goes through a pull request; OpenDraft never commits directly to the
default branch.

### Install scope for contributors

A contributor **without write access** must install OpenDraft on their
**personal account with All repositories** access. This is not optional.
GitHub's fork API requires the app to be installed on the destination account
(the contributor's personal account) with access to **all repositories**, and
on the source account with access to the source repository. A selected-
repositories install on the personal account is not enough, so the app prompts
the contributor to install again with All repositories before forking.

Upstream repository owners must install the app for suggestions: without an
install on the source account granting access to the source repository, GitHub
refuses the fork and the suggestion flow is blocked. For private upstream
repositories, an install that does not allow forking also blocks suggestions;
viewers are asked to request write access from a maintainer.

The suggest-edit endpoints are sign-in only and use the same user access token:

| Endpoint | Purpose |
|----------|---------|
| `GET /@api/repos/{owner}/{repo}/branches?prefix=opendraft/{login}/` | List suggestion branches and their head SHAs. |
| `GET /@api/repos/{owner}/{repo}/pulls?head={owner}:{branch}` | Find the latest pull request for a suggestion branch; the response includes the PR `headSha` used by the cleanup sweep. |
| `DELETE /@api/repos/{owner}/{repo}/branches/{branch}` | Delete a suggestion branch. Only accepts branch names under the session user's own prefixes (`od-<login>/` and legacy `opendraft/<login>/`, case-insensitive), so the default branch and other users' branches can never be deleted. Idempotent: a `404` or `422` from GitHub is treated as already deleted. Requires only **Contents write**. |
| `POST /@api/repos/{owner}/{repo}/merge-upstream` | Best-effort sync a fork branch from the upstream default branch (`{"branch":"..."}` body; `409 conflict` on a merge conflict). Skipped when the draft already lives on the upstream itself, because GitHub rejects merge-upstream on a non-fork. |

These endpoints require only **Contents read/write** and **Pull requests
read/write** (plus the implied Metadata read); no additional permissions are
needed for suggest edits. Branch names use `od-<login>/<YYYYMMDD-HHmmss>` on
non-fork drafts and `opendraft/<login>/<YYYYMMDD-HHmmss>` on the contributor's
fork, with times in UTC.

### Cleaning up old draft branches

Old remote draft branches are removed by a stateless sweep. For the push-target
repository (`source.owner/source.repo`) it lists the viewer's branches under
`od-<login>/` (lowercased login) and the legacy `opendraft/<login>/` prefix, and
for each branch looks up its latest pull request. A branch is deleted only when
its latest PR is **closed**, or when the PR is **merged** *and* the branch head
SHA equals the PR's `headSha` (the SHA guard prevents deleting a branch that was
reused after the merge). Branches with an **open** PR or with **no** PR are kept,
as is the current `source.branch`. Each sweep inspects at most 20 candidates.

The sweep runs at the end of every "Start a new draft" restart, after the
local-first steps (commit WIP, fetch, rebase, rename branch, registry update),
so a failed remote delete never leaves local state inconsistent; and it runs
once per project when the project opens (not on every window focus). Deletion
is best-effort.


## 9. Checklist per environment

- [ ] App created with the correct name, homepage, callback URL, and setup URL.
- [ ] Request user authorization (OAuth) during installation OFF; token expiry
      ON; device flow OFF.
- [ ] Setup URL set to `<origin>/@api/auth/install/callback`; Redirect on update
      ON.
- [ ] Webhooks inactive.
- [ ] Public app.
- [ ] Repository permissions: Metadata read; Contents, Pull requests, Workflows
      read/write; repository creation (or Administration read/write if the
      narrower option is unavailable).
- [ ] No account permissions.
- [ ] Suggest edits: required permissions stay Contents and Pull requests
      read/write; contributors without write access install on their personal
      account with All repositories.
- [ ] Client secret generated and stored as a deployment secret.
- [ ] Session key generated with `openssl rand -base64 32` and stored as a
      deployment secret.
- [ ] Optional app private key generated, stored as `BFF_GITHUB_APP_PRIVATE_KEY` (Multiline + Literal), and never committed.
