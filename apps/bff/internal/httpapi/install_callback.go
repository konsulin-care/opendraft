package httpapi

import (
	"net/http"
	"net/url"

	"github.com/konsulin-care/opendraft/apps/bff/internal/session"
)

// installCallbackPath is the GitHub App Setup URL. GitHub calls it after the
// installation flow and appends a spoofable installation_id, which this
// handler deliberately ignores.
const installCallbackPath = "/@api/auth/install/callback"

// handleInstallCallback completes the GitHub App installation flow. It reads
// the return path from the sealed transaction cookie, clears the cookie and
// sends the browser to that path when a valid session exists, otherwise to the
// login endpoint with return_to so login resumes the installation. GitHub's
// installation_id and setup_action query values are ignored because a caller
// can forge them.
func (h *authHandler) handleInstallCallback(w http.ResponseWriter, r *http.Request) {
	now := h.now()

	returnTo := "/"
	if tx, err := session.ReadTx(r, h.sealer, now); err == nil {
		returnTo = safeReturnTo(tx.ReturnTo)
	}
	session.ClearTx(w)

	if _, err := session.Read(r, h.sealer, now); err != nil {
		http.Redirect(w, r, loginPath+"?return_to="+url.QueryEscape(returnTo), seeOtherCode)
		return
	}

	http.Redirect(w, r, returnTo, seeOtherCode)
}
