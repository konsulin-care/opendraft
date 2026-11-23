package httpapi

import (
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/konsulin-care/opendraft/apps/bff/internal/config"
	"github.com/konsulin-care/opendraft/apps/bff/internal/github"
	"github.com/konsulin-care/opendraft/apps/bff/internal/session"
)

const (
	loginPath    = "/@api/auth/login"
	installPath  = "/@api/auth/install"
	returnToKey  = "return_to"
	stateBytes   = 32
	redirectCode = http.StatusFound
)

// authHandler serves the GitHub App login and install redirects.
type authHandler struct {
	cfg       config.Config
	github    *github.Client
	sealer    *session.Sealer
	now       func() time.Time
	authorize func(state, challenge string) string
	install   func(state string) string
}

// newAuthHandler builds the auth handler and binds the GitHub URL builders.
func newAuthHandler(cfg config.Config, deps Deps) *authHandler {
	return &authHandler{
		cfg:    cfg,
		github: deps.GitHub,
		sealer: deps.Sealer,
		now:    deps.Now,
		authorize: func(state, challenge string) string {
			return deps.GitHub.AuthorizeURL(cfg.CallbackURL(), state, challenge)
		},
		install: func(state string) string {
			return deps.GitHub.InstallURL(cfg.GitHubAppSlug, state)
		},
	}
}

// handleLogin starts the OAuth flow and redirects to GitHub's authorize URL
// with a fresh state and PKCE challenge.
func (h *authHandler) handleLogin(w http.ResponseWriter, r *http.Request) {
	state, err := newState()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
		return
	}
	verifier, challenge := github.NewPKCE()

	tx := session.Tx{
		State:     state,
		Verifier:  verifier,
		ReturnTo:  safeReturnTo(r.URL.Query().Get(returnToKey)),
		ExpiresAt: h.now().Add(session.TxMaxAge * time.Second),
	}
	if err := session.WriteTx(w, h.sealer, tx); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
		return
	}

	http.Redirect(w, r, h.authorize(state, challenge), redirectCode)
}

// handleInstall redirects to the GitHub App installation flow. It stores the
// state and return path in the transaction cookie without a PKCE verifier
// because an installation is not an OAuth authorization step.
func (h *authHandler) handleInstall(w http.ResponseWriter, r *http.Request) {
	state, err := newState()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
		return
	}

	tx := session.Tx{
		State:     state,
		ReturnTo:  safeReturnTo(r.URL.Query().Get(returnToKey)),
		ExpiresAt: h.now().Add(session.TxMaxAge * time.Second),
	}
	if err := session.WriteTx(w, h.sealer, tx); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
		return
	}

	http.Redirect(w, r, h.install(state), redirectCode)
}

// newState returns 32 random bytes encoded as unpadded base64url.
func newState() (string, error) {
	raw := make([]byte, stateBytes)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

// safeReturnTo accepts only a same-origin relative path. Values that do not
// start with a single slash, start with "//" or "/\", or carry a scheme or host
// fall back to "/".
func safeReturnTo(raw string) string {
	if !strings.HasPrefix(raw, "/") || strings.HasPrefix(raw, "//") || strings.HasPrefix(raw, "/\\") {
		return "/"
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme != "" || parsed.Host != "" {
		return "/"
	}
	return raw
}
