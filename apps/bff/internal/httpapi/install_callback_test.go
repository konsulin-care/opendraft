package httpapi

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/konsulin-care/opendraft/apps/bff/internal/session"
)

const installCallbackTestReturnTo = "/owner/repo/tree/main"

// installCallbackRequest builds a setup-url request with a sealed transaction
// cookie and the spoofable installation_id/setup_action query values GitHub
// appends.
func installCallbackRequest(t *testing.T, sealer *session.Sealer, now time.Time, returnTo string) *http.Request {
	t.Helper()

	tx := session.Tx{
		ReturnTo:  returnTo,
		ExpiresAt: now.Add(5 * time.Minute),
	}
	query := url.Values{"installation_id": {"999"}, "setup_action": {"update"}}
	req := httptest.NewRequest(http.MethodGet, installCallbackPath+"?"+query.Encode(), nil)
	req.AddCookie(sealedTxCookie(t, sealer, tx))
	return req
}

func TestInstallCallbackWithSessionRedirectsToReturnTo(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	fake := newFakeGitHub(t)
	handler, sealer, _ := newCallbackServer(t, fake, now)

	req := installCallbackRequest(t, sealer, now, installCallbackTestReturnTo)
	req.AddCookie(sessionCookie(t, sealer, liveSession(now), now))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusSeeOther {
		t.Fatalf("status = %d, want 303", rec.Code)
	}
	if got := rec.Header().Get("Location"); got != installCallbackTestReturnTo {
		t.Errorf("Location = %q, want %q (installation_id must be ignored)", got, installCallbackTestReturnTo)
	}
	if cleared := responseCookie(rec, session.TxCookieName); cleared == nil || cleared.MaxAge != -1 {
		t.Errorf("transaction cookie not cleared: %+v", cleared)
	}
	if fake.requests != 0 {
		t.Errorf("GitHub received %d requests, want 0", fake.requests)
	}
}

func TestInstallCallbackWithoutSessionRedirectsToLogin(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	fake := newFakeGitHub(t)
	handler, sealer, _ := newCallbackServer(t, fake, now)

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, installCallbackRequest(t, sealer, now, installCallbackTestReturnTo))

	if rec.Code != http.StatusSeeOther {
		t.Fatalf("status = %d, want 303", rec.Code)
	}
	location, err := url.Parse(rec.Header().Get("Location"))
	if err != nil {
		t.Fatalf("parse Location: %v", err)
	}
	if location.Path != loginPath {
		t.Errorf("Location path = %q, want %q", location.Path, loginPath)
	}
	if got := location.Query().Get(returnToKey); got != installCallbackTestReturnTo {
		t.Errorf("return_to = %q, want %q", got, installCallbackTestReturnTo)
	}
	if cleared := responseCookie(rec, session.TxCookieName); cleared == nil || cleared.MaxAge != -1 {
		t.Errorf("transaction cookie not cleared: %+v", cleared)
	}
}
