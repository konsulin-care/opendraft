package httpapi

import (
	"crypto/subtle"
	"errors"
	"net/http"
	"strings"

	"github.com/konsulin-care/opendraft/apps/bff/internal/github"
	"github.com/konsulin-care/opendraft/apps/bff/internal/session"
)

const (
	callbackPath      = "/@api/auth/callback"
	callbackCodeKey   = "code"
	callbackStateKey  = "state"
	invalidStateCode  = "invalid_state"
	authErrorCode     = "exchange_failed"
	authErrorLocation = "/?auth_error=" + authErrorCode
	unverifiedEmail   = "unverified_email"
	seeOtherCode      = http.StatusSeeOther
)

// handleCallback completes the OAuth flow: it validates the transaction and
// state, exchanges the code with the stored PKCE verifier, loads the GitHub
// user, seals the session and sends the browser back to return_to.
func (h *authHandler) handleCallback(w http.ResponseWriter, r *http.Request) {
	now := h.now()

	tx, err := session.ReadTx(r, h.sealer, now)
	if err != nil {
		rejectState(w)
		return
	}
	state := r.URL.Query().Get(callbackStateKey)
	if subtle.ConstantTimeCompare([]byte(state), []byte(tx.State)) != 1 {
		rejectState(w)
		return
	}

	tokens, err := h.github.ExchangeCode(r.Context(), r.URL.Query().Get(callbackCodeKey), tx.Verifier, h.cfg.CallbackURL())
	if err != nil {
		if errors.Is(err, github.ErrUnverifiedEmail) {
			failUnverifiedEmail(w, r, tx.ReturnTo)
			return
		}
		failExchange(w, r)
		return
	}

	user, err := h.github.FetchUser(r.Context(), tokens.AccessToken)
	if err != nil {
		failExchange(w, r)
		return
	}

	sess := session.Session{
		Login:            user.Login,
		ID:               user.ID,
		Name:             user.Name,
		AccessToken:      tokens.AccessToken,
		AccessExpiresAt:  tokens.AccessExpiresAt,
		RefreshToken:     tokens.RefreshToken,
		RefreshExpiresAt: tokens.RefreshExpiresAt,
		IssuedAt:         now,
	}
	if err := session.Write(w, h.sealer, sess, now); err != nil {
		failExchange(w, r)
		return
	}

	session.ClearTx(w)
	http.Redirect(w, r, safeReturnTo(tx.ReturnTo), seeOtherCode)
}

// rejectState answers a callback whose transaction is missing, expired or does
// not match the state query without contacting GitHub.
func rejectState(w http.ResponseWriter) {
	session.ClearTx(w)
	writeJSON(w, http.StatusBadRequest, map[string]string{"error": invalidStateCode})
}

// failExchange clears the transaction and redirects to the generic auth error
// page without leaking the upstream response or starting a session.
func failExchange(w http.ResponseWriter, r *http.Request) {
	session.ClearTx(w)
	http.Redirect(w, r, authErrorLocation, seeOtherCode)
}

// failUnverifiedEmail clears the transaction and sends the browser back to the
// transaction return_to with a friendly unverified-email auth error.
func failUnverifiedEmail(w http.ResponseWriter, r *http.Request, returnTo string) {
	session.ClearTx(w)
	http.Redirect(w, r, appendAuthError(safeReturnTo(returnTo), unverifiedEmail), seeOtherCode)
}

// appendAuthError appends auth_error=code to target, choosing the query
// separator so an existing query string is preserved.
func appendAuthError(target, code string) string {
	separator := "?"
	if strings.Contains(target, "?") {
		separator = "&"
	}
	return target + separator + "auth_error=" + code
}
