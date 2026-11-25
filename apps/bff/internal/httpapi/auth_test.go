package httpapi

import (
	"crypto/sha256"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/konsulin-care/opendraft/apps/bff/internal/config"
	"github.com/konsulin-care/opendraft/apps/bff/internal/github"
	"github.com/konsulin-care/opendraft/apps/bff/internal/session"
)

const authTestNowUnix = 1700000000

// newAuthServer builds the BFF handler with a real sealer and GitHub client
// pointed at a fake web origin.
func newAuthServer(t *testing.T) (http.Handler, *session.Sealer, config.Config) {
	t.Helper()

	cfg := config.Config{
		PublicOrigin:   testPublicOrigin,
		GitHubClientID: testClientID,
		GitHubAppSlug:  testAppSlug,
		GitHubWebURL:   "https://github.example",
	}
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i + 1)
	}
	sealer, err := session.NewSealer(key, nil)
	if err != nil {
		t.Fatalf("NewSealer: %v", err)
	}
	now := time.Unix(authTestNowUnix, 0).UTC()
	deps := Deps{
		Now: func() time.Time { return now },
		GitHub: &github.Client{
			WebURL:   cfg.GitHubWebURL,
			ClientID: cfg.GitHubClientID,
			Now:      func() time.Time { return now },
		},
		Sealer: sealer,
	}
	return New(cfg, deps), sealer, cfg
}

// txCookie returns the OAuth transaction cookie from a recorder or fails.
func txCookie(t *testing.T, rec *httptest.ResponseRecorder) *http.Cookie {
	t.Helper()

	for _, cookie := range rec.Result().Cookies() {
		if cookie.Name == session.TxCookieName {
			return cookie
		}
	}
	t.Fatalf("response did not set %s", session.TxCookieName)
	return nil
}

// readTxFromCookie opens the transaction stored in cookie.
func readTxFromCookie(t *testing.T, sealer *session.Sealer, cookie *http.Cookie) session.Tx {
	t.Helper()

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.AddCookie(cookie)
	tx, err := session.ReadTx(req, sealer, time.Unix(authTestNowUnix, 0).UTC())
	if err != nil {
		t.Fatalf("ReadTx: %v", err)
	}
	return tx
}

// loginResponse serves target and returns the recorder and parsed Location of a
// 302 answer.
func loginResponse(t *testing.T, handler http.Handler, target string) (*httptest.ResponseRecorder, *url.URL) {
	t.Helper()

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, target, nil))
	if rec.Code != http.StatusFound {
		t.Fatalf("status = %d, want 302", rec.Code)
	}
	location, err := url.Parse(rec.Header().Get("Location"))
	if err != nil {
		t.Fatalf("parse Location: %v", err)
	}
	return rec, location
}

// assertAuthorizeLocation checks the redirect targets GitHub authorize with the
// configured callback URL.
func assertAuthorizeLocation(t *testing.T, location *url.URL, cfg config.Config) {
	t.Helper()

	if location.Path != "/login/oauth/authorize" {
		t.Fatalf("path = %q, want /login/oauth/authorize", location.Path)
	}
	if got := location.Query().Get("redirect_uri"); got != cfg.CallbackURL() {
		t.Fatalf("redirect_uri = %q, want %q", got, cfg.CallbackURL())
	}
}

// assertTxCookieAttributes checks the transaction cookie is scoped, secure and
// short lived.
func assertTxCookieAttributes(t *testing.T, cookie *http.Cookie) {
	t.Helper()

	if cookie.Path != "/" {
		t.Errorf("Path = %q, want /", cookie.Path)
	}
	if !cookie.Secure {
		t.Error("cookie is not Secure")
	}
	if !cookie.HttpOnly {
		t.Error("cookie is not HttpOnly")
	}
	if cookie.SameSite != http.SameSiteLaxMode {
		t.Errorf("SameSite = %v, want Lax", cookie.SameSite)
	}
	if cookie.MaxAge != 600 {
		t.Errorf("MaxAge = %d, want 600", cookie.MaxAge)
	}
}

// assertLoginState checks the stored transaction matches the redirect state and
// that the challenge is the S256 hash of the stored verifier.
func assertLoginState(t *testing.T, tx session.Tx, location *url.URL) {
	t.Helper()

	state := location.Query().Get("state")
	if state == "" {
		t.Fatal("state is empty")
	}
	raw, err := base64.RawURLEncoding.DecodeString(state)
	if err != nil || len(raw) != 32 {
		t.Fatalf("state %q is not 32 bytes of unpadded base64url (err %v)", state, err)
	}
	if tx.State != state {
		t.Errorf("stored state = %q, want %q", tx.State, state)
	}
	if tx.ReturnTo != callbackTestRepo {
		t.Errorf("ReturnTo = %q, want %q", tx.ReturnTo, callbackTestRepo)
	}
	if tx.Verifier == "" {
		t.Fatal("stored verifier is empty")
	}
	sum := sha256.Sum256([]byte(tx.Verifier))
	wantChallenge := base64.RawURLEncoding.EncodeToString(sum[:])
	if got := location.Query().Get("code_challenge"); got != wantChallenge {
		t.Errorf("code_challenge = %q, want %q", got, wantChallenge)
	}
	if got := location.Query().Get("code_challenge_method"); got != "S256" {
		t.Errorf("code_challenge_method = %q, want S256", got)
	}
}

func TestLoginRedirectsToAuthorizeWithStateAndPKCE(t *testing.T) {
	handler, sealer, cfg := newAuthServer(t)

	rec, location := loginResponse(t, handler, loginPath+"?return_to="+callbackTestRepo)
	assertAuthorizeLocation(t, location, cfg)
	cookie := txCookie(t, rec)
	assertTxCookieAttributes(t, cookie)
	assertLoginState(t, readTxFromCookie(t, sealer, cookie), location)
}

func TestInstallRedirectsWithSameState(t *testing.T) {
	handler, sealer, _ := newAuthServer(t)

	rec := getStatic(handler, "/@api/auth/install")
	if rec.Code != http.StatusFound {
		t.Fatalf("status = %d, want 302", rec.Code)
	}
	location, err := url.Parse(rec.Header().Get("Location"))
	if err != nil {
		t.Fatalf("parse Location: %v", err)
	}
	wantPath := "/apps/opendraft-app/installations/new"
	if location.Path != wantPath {
		t.Fatalf("path = %q, want %q", location.Path, wantPath)
	}
	state := location.Query().Get("state")
	if state == "" {
		t.Fatal("state is empty")
	}

	cookie := txCookie(t, rec)
	tx := readTxFromCookie(t, sealer, cookie)
	if tx.State != state {
		t.Errorf("stored state = %q, want %q", tx.State, state)
	}
	if tx.Verifier != "" {
		t.Errorf("stored verifier = %q, want empty for install", tx.Verifier)
	}
	if tx.ReturnTo != "/" {
		t.Errorf("ReturnTo = %q, want /", tx.ReturnTo)
	}
}

func TestReturnToSanitized(t *testing.T) {
	handler, sealer, _ := newAuthServer(t)

	cases := []struct {
		raw  string
		want string
	}{
		{"", "/"},
		{"/", "/"},
		{"/owner/repo/tree/main", "/owner/repo/tree/main"},
		{"//evil.com", "/"},
		{"https://evil.com", "/"},
		{"/\\evil.com", "/"},
		{"evil.com", "/"},
	}
	for _, tc := range cases {
		target := "/@api/auth/login"
		if tc.raw != "" {
			target += "?return_to=" + url.QueryEscape(tc.raw)
		}
		rec := getStatic(handler, target)
		if rec.Code != http.StatusFound {
			t.Fatalf("return_to %q status = %d, want 302", tc.raw, rec.Code)
		}
		tx := readTxFromCookie(t, sealer, txCookie(t, rec))
		if tx.ReturnTo != tc.want {
			t.Errorf("return_to %q stored as %q, want %q", tc.raw, tx.ReturnTo, tc.want)
		}
	}
}

func TestSafeReturnToRejectsSchemePaths(t *testing.T) {
	for _, raw := range []string{"//evil.com", "https://evil.com", "/\\evil.com"} {
		if got := safeReturnTo(raw); got != "/" {
			t.Errorf("safeReturnTo(%q) = %q, want /", raw, got)
		}
	}
	if got := safeReturnTo("/owner/repo"); got != "/owner/repo" {
		t.Errorf("safeReturnTo(/owner/repo) = %q, want /owner/repo", got)
	}
	if strings.HasPrefix(safeReturnTo("/owner/repo"), "//") {
		t.Error("safeReturnTo produced a protocol-relative path")
	}
}
