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

## 1. Basic information

Set the following for each app.

| Field | Production | Development |
|-------|------------|-------------|
| GitHub App name | `OpenDraft` | `OpenDraft Dev` |
| Homepage URL | `https://publish.konsulin.care` | `http://127.0.0.1:5173` or `https://<host>.ts.net` |
| Callback URL | `https://publish.konsulin.care/@api/auth/callback` | `http://127.0.0.1:5173/@api/auth/callback` or `https://<host>.ts.net/@api/auth/callback` |

The callback URL is always `BFF_PUBLIC_ORIGIN` + `/@api/auth/callback`. It must
match the deployed `BFF_PUBLIC_ORIGIN` exactly, including scheme and port.

Under **Identifying and authorizing users**:

- **Request user authorization (OAuth) during installation**: ON
- **Expire user authorization tokens**: ON (8-hour access tokens with a
  ~6-month refresh token; the BFF refreshes them server-side)
- **Enable Device Flow**: OFF
- Install callback / setup URL: leave empty, OpenDraft returns users to the
  `returnTo` path carried in the sealed OAuth transaction cookie.

Under **Post installation**:

- **Setup URL**: leave empty.
- **Redirect on update**: OFF.

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
for installation tokens at runtime: private-key-backed installation tokens are
not used, and no private key is generated yet (see section 5).

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

## 5. Private key (deferred)

Do **not** generate an app private key yet. OpenDraft intentionally does not
store one: runtime operations use GitHub App **user access tokens**, so no
installation token and no private key are required. Keep this deferred until a
feature explicitly needs installation tokens (for example app-initiated work
without a signed-in user).

When that day comes, the procedure will be:

1. Generate a private key on the GitHub App settings page and download the PEM.
2. Store it as a deployment secret referenced by a future
   `BFF_GITHUB_PRIVATE_KEY_FILE` (never in the repository or image).
3. Load it server-side only, use it to mint short-lived installation tokens, and
   never expose it to the browser.
4. Rotate by generating a new key on GitHub, deploying it, then deleting the old
   key once no process uses it.

## 6. Wiring the apps into the BFF

Set the deployment environment from the app's settings page.

| Variable | Value |
|----------|-------|
| `BFF_PUBLIC_ORIGIN` | `https://publish.konsulin.care` (prod) / dev origin |
| `BFF_GITHUB_CLIENT_ID` | The app's client ID |
| `BFF_GITHUB_CLIENT_SECRET_FILE` | Path to the mounted client secret |
| `BFF_GITHUB_APP_SLUG` | The app slug, e.g. `opendraft` / `opendraft-dev` |
| `BFF_SESSION_KEY_FILE` | Path to the mounted 32-byte session key |
| `BFF_SESSION_KEY_PREVIOUS` | Optional previous key during rotation |

The BFF derives the callback URL as `BFF_PUBLIC_ORIGIN` + `/@api/auth/callback`
and must match the value registered above.

## 7. User entry points

- Sign in: `/#/…` triggers `GET /@api/auth/login`, which starts the OAuth flow
  with state, PKCE (S256), and the client secret.
- Install: users start the installation from `/@api/auth/install`, which
  redirects to the GitHub App installation page. After selecting an account and
  repositories they return to the pending `returnTo` path.
- Sign out: `POST /@api/auth/logout` drops the session cookie.

## 8. Checklist per environment

- [ ] App created with the correct name, homepage, and callback URL.
- [ ] OAuth during installation ON; token expiry ON; device flow OFF.
- [ ] Webhooks inactive.
- [ ] Public app.
- [ ] Repository permissions: Metadata read; Contents, Pull requests, Workflows
      read/write; repository creation (or Administration read/write if the
      narrower option is unavailable).
- [ ] No account permissions.
- [ ] Client secret generated and stored as a deployment secret.
- [ ] Session key generated with `openssl rand -base64 32` and stored as a
      deployment secret.
- [ ] No private key generated (deferred until a feature needs it).
