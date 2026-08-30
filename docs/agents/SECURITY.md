# SECURITY.md — Auth, Secrets, Least-Privilege

## Principles

- Least-privilege: request only required permissions.
- No secret exposure: BFF never exposes private keys or tokens to browser.
- No arbitrary proxying: BFF handles specific auth flows only.

## GitHub Authorization Modes

### Installation Authorization (existing repos)

Used for normal repository operations:
- Read/write repository content
- Manage issues and PRs
- Access via installation token

### User Authorization (privileged ops)

Used for operations requiring user consent:
- Repository creation
- Fork to user account
- Access via user OAuth token

## BFF Security Constraints

The BFF must never expose:
- GitHub App private keys
- OAuth client secrets
- Refresh tokens (unless necessary)
- Installation private credentials

The BFF must not:
- Proxy arbitrary GitHub API calls
- Store manuscripts or publications
- Maintain user sessions beyond token expiry

## Token Flow

```text
Browser                BFF                  GitHub
  │                     │                     │
  │── OAuth code ──────>│                     │
  │                     │── Exchange code ────>│
  │<── Access token ────│<── Token ───────────│
  │                     │                     │
  │── Use token for GitHub API ──────────────>│
```

## References

- [apps/convention.md](../../apps/convention.md)
- [docs/ADR/010-github-integration.md](../ADR/010-github-integration.md)
- [docs/ADR/011-bff-scope.md](../ADR/011-bff-scope.md)
- [docs/ADR/012-security-model.md](../ADR/012-security-model.md)
