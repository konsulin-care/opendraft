package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/konsulin-care/opendraft/apps/bff/internal/config"
	"github.com/konsulin-care/opendraft/apps/bff/internal/github"
	"github.com/konsulin-care/opendraft/apps/bff/internal/session"
)

// newSessionFixture builds the auth handler, sealer and config pointed at a
// fake GitHub server for the session middleware tests.
func newSessionFixture(t *testing.T, fake *fakeGitHub, now time.Time) (*authHandler, *session.Sealer, config.Config) {
	t.Helper()

	cfg := config.Config{
		PublicOrigin:       "https://publish.example",
		GitHubClientID:     "client-id",
		GitHubClientSecret: "client-secret",
		GitHubAppSlug:      "opendraft-app",
		GitHubWebURL:       fake.server.URL,
		GitHubAPIURL:       fake.server.URL,
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
	return newAuthHandler(cfg, deps), sealer, cfg
}

// sessionCookie seals sess into a session cookie for a test request.
func sessionCookie(t *testing.T, sealer *session.Sealer, sess session.Session, now time.Time) *http.Cookie {
	t.Helper()

	rec := httptest.NewRecorder()
	if err := session.Write(rec, sealer, sess, now); err != nil {
		t.Fatalf("session.Write: %v", err)
	}
	cookie := responseCookie(rec, session.CookieName)
	if cookie == nil {
		t.Fatal("session.Write did not set the cookie")
	}
	return cookie
}

// liveSession returns a session whose absolute lifetime and tokens are valid
// at now.
func liveSession(now time.Time) session.Session {
	return session.Session{
		Login:            "octocat",
		ID:               42,
		Name:             "The Octocat",
		AccessToken:      "old-access",
		AccessExpiresAt:  now.Add(8 * time.Hour),
		RefreshToken:     callbackTestRefresh,
		RefreshExpiresAt: now.Add(180 * 24 * time.Hour),
		IssuedAt:         now,
	}
}

// decodeAnyJSON decodes a recorder body into a generic JSON object.
func decodeAnyJSON(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()

	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode JSON body %q: %v", rec.Body.String(), err)
	}
	return body
}

func TestSessionEndpointReturnsIdentityWithoutTokens(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	fake := newFakeGitHub(t)
	handler, sealer, _ := newCallbackServer(t, fake, now)

	req := httptest.NewRequest(http.MethodGet, sessionPath, nil)
	req.AddCookie(sessionCookie(t, sealer, liveSession(now), now))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	body := decodeAnyJSON(t, rec)
	if body["login"] != "octocat" {
		t.Errorf("login = %v, want octocat", body["login"])
	}
	if body["id"] != float64(42) {
		t.Errorf("id = %v, want 42", body["id"])
	}
	if body["name"] != "The Octocat" {
		t.Errorf("name = %v, want The Octocat", body["name"])
	}
	wantExpiry := now.Add(session.MaxLifetime).Format(time.RFC3339)
	if body["expiresAt"] != wantExpiry {
		t.Errorf("expiresAt = %v, want %v", body["expiresAt"], wantExpiry)
	}
	for _, key := range []string{"access_token", "refresh_token", "token", "accessToken", "refreshToken"} {
		if _, ok := body[key]; ok {
			t.Errorf("response exposes %q", key)
		}
	}
	raw := rec.Body.String()
	for _, secret := range []string{"old-access", callbackTestRefresh} {
		if strings.Contains(raw, secret) {
			t.Errorf("response body leaks %q: %s", secret, raw)
		}
	}
}

func TestSessionEndpointWithoutSessionReturnsUnauthenticated(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	fake := newFakeGitHub(t)
	handler, _, _ := newCallbackServer(t, fake, now)

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, sessionPath, nil))

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
	if body := decodeJSON(t, rec); body["error"] != unauthenticatedCode {
		t.Errorf("error = %q, want %q", body["error"], unauthenticatedCode)
	}
	if fake.requests != 0 {
		t.Errorf("GitHub received %d requests, want 0", fake.requests)
	}
}

func TestRequireSessionRefreshesExpiringAccessToken(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	fake := newFakeGitHub(t)
	auth, sealer, _ := newSessionFixture(t, fake, now)

	sess := liveSession(now)
	sess.AccessExpiresAt = now.Add(30 * time.Second)
	cookie := sessionCookie(t, sealer, sess, now)

	var got session.Session
	ran := false
	mw := auth.requireSession(func(w http.ResponseWriter, _ *http.Request, s session.Session) {
		ran = true
		got = s
		w.WriteHeader(http.StatusOK)
	})
	req := httptest.NewRequest(http.MethodGet, sessionPath, nil)
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()
	mw.ServeHTTP(rec, req)

	if !ran {
		t.Fatal("next handler did not run")
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if got.AccessToken != callbackTestAccess {
		t.Errorf("handler token = %q, want refreshed token", got.AccessToken)
	}
	if fake.exchangeForm.Get("grant_type") != "refresh_token" {
		t.Errorf("grant_type = %q, want refresh_token", fake.exchangeForm.Get("grant_type"))
	}
	if fake.exchangeForm.Get("refresh_token") != callbackTestRefresh {
		t.Errorf("refresh_token = %q, want stored token", fake.exchangeForm.Get("refresh_token"))
	}

	reissued := responseCookie(rec, session.CookieName)
	if reissued == nil {
		t.Fatal("refreshed session was not re-issued")
	}
	readReq := httptest.NewRequest(http.MethodGet, "/", nil)
	readReq.AddCookie(reissued)
	stored, err := session.Read(readReq, sealer, now)
	if err != nil {
		t.Fatalf("read re-issued session: %v", err)
	}
	if stored.AccessToken != callbackTestAccess {
		t.Errorf("re-issued token = %q, want refreshed token", stored.AccessToken)
	}
}

func TestRequireSessionFailedRefreshClearsAndRejects(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	fake := newFakeGitHub(t)
	fake.failExchange = true
	auth, sealer, _ := newSessionFixture(t, fake, now)

	sess := liveSession(now)
	sess.AccessExpiresAt = now.Add(10 * time.Second)
	cookie := sessionCookie(t, sealer, sess, now)

	ran := false
	mw := auth.requireSession(func(http.ResponseWriter, *http.Request, session.Session) {
		ran = true
	})
	req := httptest.NewRequest(http.MethodGet, sessionPath, nil)
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()
	mw.ServeHTTP(rec, req)

	if ran {
		t.Fatal("next handler ran after a failed refresh")
	}
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
	if body := decodeJSON(t, rec); body["error"] != unauthenticatedCode {
		t.Errorf("error = %q, want %q", body["error"], unauthenticatedCode)
	}
	cleared := responseCookie(rec, session.CookieName)
	if cleared == nil || cleared.MaxAge != -1 || cleared.Value != "" {
		t.Errorf("session cookie not cleared: %+v", cleared)
	}
	if strings.Contains(rec.Body.String(), "bad_verification_code") {
		t.Errorf("response leaks upstream error: %s", rec.Body.String())
	}
}

func TestRequireSessionExpiredRefreshTokenClearsAndRejects(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	fake := newFakeGitHub(t)
	auth, sealer, _ := newSessionFixture(t, fake, now)

	sess := liveSession(now)
	sess.AccessExpiresAt = now.Add(10 * time.Second)
	sess.RefreshExpiresAt = now.Add(-time.Minute)
	cookie := sessionCookie(t, sealer, sess, now)

	ran := false
	mw := auth.requireSession(func(http.ResponseWriter, *http.Request, session.Session) {
		ran = true
	})
	req := httptest.NewRequest(http.MethodGet, sessionPath, nil)
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()
	mw.ServeHTTP(rec, req)

	if ran {
		t.Fatal("next handler ran with an expired refresh token")
	}
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
	if body := decodeJSON(t, rec); body["error"] != unauthenticatedCode {
		t.Errorf("error = %q, want %q", body["error"], unauthenticatedCode)
	}
	cleared := responseCookie(rec, session.CookieName)
	if cleared == nil || cleared.MaxAge != -1 {
		t.Errorf("session cookie not cleared: %+v", cleared)
	}
	if fake.requests != 0 {
		t.Errorf("GitHub received %d requests, want 0", fake.requests)
	}
}
