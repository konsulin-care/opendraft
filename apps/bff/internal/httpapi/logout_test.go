package httpapi

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/konsulin-care/opendraft/apps/bff/internal/config"
	"github.com/konsulin-care/opendraft/apps/bff/internal/github"
	"github.com/konsulin-care/opendraft/apps/bff/internal/session"
)

const logoutTestOrigin = "https://publish.example"

// revokeRecorder captures the token revocation request a fake GitHub receives.
type revokeRecorder struct {
	method   string
	path     string
	user     string
	password string
	body     map[string]string
	status   int
	requests int
}

// newLogoutServer builds the full BFF handler pointed at a fake GitHub token
// endpoint that answers status and records the revocation request.
func newLogoutServer(t *testing.T, now time.Time, status int) (http.Handler, *session.Sealer, *revokeRecorder) {
	t.Helper()

	rec := &revokeRecorder{status: status}
	fake := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rec.requests++
		rec.method = r.Method
		rec.path = r.URL.Path
		rec.user, rec.password, _ = r.BasicAuth()
		body, _ := io.ReadAll(io.LimitReader(r.Body, 1<<20))
		rec.body = map[string]string{}
		_ = json.Unmarshal(body, &rec.body)
		w.WriteHeader(rec.status)
	}))
	t.Cleanup(fake.Close)

	cfg := config.Config{
		PublicOrigin:       logoutTestOrigin,
		GitHubClientID:     "client-id",
		GitHubClientSecret: "client-secret",
		GitHubAppSlug:      "opendraft-app",
		GitHubWebURL:       fake.URL,
		GitHubAPIURL:       fake.URL,
	}
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i + 1)
	}
	sealer, err := session.NewSealer(key, nil)
	if err != nil {
		t.Fatalf("NewSealer: %v", err)
	}
	deps := Deps{
		Now: func() time.Time { return now },
		GitHub: &github.Client{
			WebURL:       cfg.GitHubWebURL,
			APIURL:       cfg.GitHubAPIURL,
			ClientID:     cfg.GitHubClientID,
			ClientSecret: cfg.GitHubClientSecret,
			Now:          func() time.Time { return now },
		},
		Sealer: sealer,
	}
	return New(cfg, deps), sealer, rec
}

// logoutRequest builds a same-origin POST to the logout endpoint.
func logoutRequest(cookie *http.Cookie) *http.Request {
	req := httptest.NewRequest(http.MethodPost, logoutPath, nil)
	req.Header.Set("Origin", logoutTestOrigin)
	if cookie != nil {
		req.AddCookie(cookie)
	}
	return req
}

// assertSessionCleared checks that a response expired the session cookie.
func assertSessionCleared(t *testing.T, rec *httptest.ResponseRecorder) {
	t.Helper()

	cleared := responseCookie(rec, session.CookieName)
	if cleared == nil || cleared.MaxAge != -1 || cleared.Value != "" {
		t.Errorf("session cookie not cleared: %+v", cleared)
	}
}

func TestLogoutRevokesTokenAndClearsSession(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	handler, sealer, got := newLogoutServer(t, now, http.StatusNoContent)
	cookie := sessionCookie(t, sealer, liveSession(now), now)

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, logoutRequest(cookie))

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", rec.Code)
	}
	if got.requests != 1 {
		t.Fatalf("revocation requests = %d, want 1", got.requests)
	}
	if got.method != http.MethodDelete {
		t.Errorf("method = %q, want DELETE", got.method)
	}
	if got.path != "/applications/client-id/token" {
		t.Errorf("path = %q, want /applications/client-id/token", got.path)
	}
	if got.user != "client-id" || got.password != "client-secret" {
		t.Errorf("basic auth = %q:%q, want client-id:client-secret", got.user, got.password)
	}
	if got.body["access_token"] != "old-access" {
		t.Errorf("access_token = %q, want old-access", got.body["access_token"])
	}
	assertSessionCleared(t, rec)
}

func TestLogoutWithoutSessionSkipsRevocationAndReturns204(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	handler, _, got := newLogoutServer(t, now, http.StatusNoContent)

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, logoutRequest(nil))

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", rec.Code)
	}
	if got.requests != 0 {
		t.Errorf("revocation requests = %d, want 0", got.requests)
	}
	assertSessionCleared(t, rec)
}

func TestLogoutIgnoresRevocationFailure(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	handler, sealer, got := newLogoutServer(t, now, http.StatusInternalServerError)
	cookie := sessionCookie(t, sealer, liveSession(now), now)

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, logoutRequest(cookie))

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", rec.Code)
	}
	if got.requests != 1 {
		t.Errorf("revocation requests = %d, want 1", got.requests)
	}
	assertSessionCleared(t, rec)
	if strings.Contains(rec.Body.String(), "old-access") {
		t.Errorf("response leaks access token: %s", rec.Body.String())
	}
}
