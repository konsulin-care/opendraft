package httpapi

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/konsulin-care/opendraft/apps/bff/internal/github"
	"github.com/konsulin-care/opendraft/apps/bff/internal/session"
)

const logoutPath = "/@api/auth/logout"

// logoutHandler serves POST /@api/auth/logout.
type logoutHandler struct {
	github *github.Client
	sealer *session.Sealer
	now    func() time.Time
	logger *slog.Logger
}

// newLogoutHandler builds the logout handler from the BFF dependencies.
func newLogoutHandler(deps Deps) *logoutHandler {
	now := deps.Now
	if now == nil {
		now = time.Now
	}
	logger := deps.Logger
	if logger == nil {
		logger = slog.Default()
	}
	return &logoutHandler{
		github: deps.GitHub,
		sealer: deps.Sealer,
		now:    now,
		logger: logger,
	}
}

// handleLogout revokes the session's access token when possible, ignores
// revocation failures, always clears the session cookie and answers 204. The
// log line never contains the token.
func (h *logoutHandler) handleLogout(w http.ResponseWriter, r *http.Request) {
	if sess, err := session.Read(r, h.sealer, h.now()); err == nil {
		if h.github != nil && sess.AccessToken != "" {
			if err := h.github.RevokeToken(r.Context(), sess.AccessToken); err != nil {
				h.logger.Warn("logout token revocation failed",
					slog.String("login", sess.Login),
					slog.String(errorKey, err.Error()),
				)
			}
		}
	}

	session.Clear(w)
	w.WriteHeader(http.StatusNoContent)
}
