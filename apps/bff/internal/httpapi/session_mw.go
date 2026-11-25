package httpapi

import (
	"net/http"
	"time"

	"github.com/konsulin-care/opendraft/apps/bff/internal/session"
)

const (
	sessionPath         = "/@api/auth/session"
	unauthenticatedCode = "unauthenticated"
	// refreshSkew is how long before access-token expiry the middleware
	// refreshes proactively.
	refreshSkew = 60 * time.Second
)

// sessionResponse is the public projection of an authenticated session. It
// never carries any token field.
type sessionResponse struct {
	Login     string `json:"login"`
	Name      string `json:"name"`
	ExpiresAt string `json:"expiresAt"`
	ID        int64  `json:"id"`
}

// requireSession wraps next with session authentication. It reads the sealed
// session cookie, refreshes the access token server-side when it is about to
// expire and the refresh token is still valid, and re-issues the cookie. A
// missing, expired or unrefreshable session clears the cookie and answers 401
// with {"error":"unauthenticated"}.
func (h *authHandler) requireSession(next func(http.ResponseWriter, *http.Request, session.Session)) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		now := h.now()

		sess, err := session.Read(r, h.sealer, now)
		if err != nil {
			rejectSession(w)
			return
		}

		if needsRefresh(sess, now) {
			tokens, err := h.github.Refresh(r.Context(), sess.RefreshToken)
			if err != nil {
				rejectSession(w)
				return
			}
			sess.AccessToken = tokens.AccessToken
			sess.AccessExpiresAt = tokens.AccessExpiresAt
			sess.RefreshToken = tokens.RefreshToken
			sess.RefreshExpiresAt = tokens.RefreshExpiresAt
			if err := session.Write(w, h.sealer, sess, now); err != nil {
				rejectSession(w)
				return
			}
		}

		next(w, r, sess)
	})
}

// handleSession serves GET /@api/auth/session with the public identity of the
// authenticated user.
func (h *authHandler) handleSession(w http.ResponseWriter, r *http.Request) {
	h.requireSession(func(w http.ResponseWriter, _ *http.Request, sess session.Session) {
		writeJSON(w, http.StatusOK, sessionResponse{
			Login:     sess.Login,
			ID:        sess.ID,
			Name:      sess.Name,
			ExpiresAt: sess.IssuedAt.Add(session.MaxLifetime).Format(time.RFC3339),
		})
	}).ServeHTTP(w, r)
}

// needsRefresh reports whether the access token is within refreshSkew of
// expiry and a refresh token is still usable.
func needsRefresh(sess session.Session, now time.Time) bool {
	if sess.RefreshToken == "" {
		return false
	}
	if !sess.RefreshExpiresAt.IsZero() && !now.Before(sess.RefreshExpiresAt) {
		return false
	}
	return !now.Before(sess.AccessExpiresAt.Add(-refreshSkew))
}

// rejectSession clears the session cookie and answers 401 with the JSON
// unauthenticated error code.
func rejectSession(w http.ResponseWriter) {
	session.Clear(w)
	writeError(w, http.StatusUnauthorized, unauthenticatedCode)
}
