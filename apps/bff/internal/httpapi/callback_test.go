package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/konsulin-care/opendraft/apps/bff/internal/config"
	"github.com/konsulin-care/opendraft/apps/bff/internal/github"
	"github.com/konsulin-care/opendraft/apps/bff/internal/session"
)

const (
	callbackTestState   = "expected-state"
	callbackTestRepo    = "/owner/repo"
	callbackTestTree    = "/owner/repo/tree/main"
	callbackTestCode    = "code-1"
	callbackTestAccess  = "ghu_access"
	callbackTestRefresh = "ghr_refresh"
)

// fakeGitHub is a stand-in for the two GitHub endpoints the callback uses.
type fakeGitHub struct {
	server       *httptest.Server
	exchangeForm url.Values
	userAuth     string
	mu           sync.Mutex
	requests     int
	// failExchange makes the token endpoint answer with an OAuth error.
	failExchange bool
	// failUser makes the user endpoint answer with a server error.
	failUser bool
}

func newFakeGitHub(t *testing.T) *fakeGitHub {
	t.Helper()
	f := &fakeGitHub{}
	f.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		f.requests++
		f.mu.Unlock()

		switch r.URL.Path {
		case "/login/oauth/access_token":
			_ = r.ParseForm()
			f.mu.Lock()
			f.exchangeForm = r.PostForm
			fail := f.failExchange
			f.mu.Unlock()
			w.Header().Set("Content-Type", "application/json")
			if fail {
				_, _ = w.Write([]byte(`{"error":"bad_verification_code","error_description":"upstream secret detail"}`))
				return
			}
			_, _ = w.Write([]byte(`{"access_token":"ghu_access","expires_in":28800,"refresh_token":"ghr_refresh","refresh_token_expires_in":15897600,"token_type":"bearer"}`))
		case "/user":
			f.mu.Lock()
			f.userAuth = r.Header.Get("Authorization")
			fail := f.failUser
			f.mu.Unlock()
			if fail {
				w.WriteHeader(http.StatusInternalServerError)
				_, _ = w.Write([]byte(`{"message":"upstream secret body"}`))
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"login":"octocat","id":42,"name":"The Octocat"}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(f.server.Close)
	return f
}

func newCallbackServer(t *testing.T, fake *fakeGitHub, now time.Time) (http.Handler, *session.Sealer, config.Config) {
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
	return New(cfg, deps), sealer, cfg
}

func sealedTxCookie(t *testing.T, sealer *session.Sealer, tx session.Tx) *http.Cookie {
	t.Helper()
	rec := httptest.NewRecorder()
	if err := session.WriteTx(rec, sealer, tx); err != nil {
		t.Fatalf("WriteTx: %v", err)
	}
	return txCookie(t, rec)
}

func callbackRequest(state, code string, cookie *http.Cookie) *http.Request {
	query := url.Values{"state": {state}, "code": {code}}
	req := httptest.NewRequest(http.MethodGet, callbackPath+"?"+query.Encode(), nil)
	if cookie != nil {
		req.AddCookie(cookie)
	}
	return req
}

func responseCookie(rec *httptest.ResponseRecorder, name string) *http.Cookie {
	for _, cookie := range rec.Result().Cookies() {
		if cookie.Name == name {
			return cookie
		}
	}
	return nil
}

func readSession(t *testing.T, sealer *session.Sealer, rec *httptest.ResponseRecorder, now time.Time) session.Session {
	t.Helper()
	cookie := responseCookie(rec, session.CookieName)
	if cookie == nil {
		t.Fatalf("response did not set %s", session.CookieName)
	}
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.AddCookie(cookie)
	sess, err := session.Read(req, sealer, now)
	if err != nil {
		t.Fatalf("read session: %v", err)
	}
	return sess
}

func callbackTx(now time.Time) session.Tx {
	return session.Tx{
		State:     callbackTestState,
		Verifier:  "verifier-xyz",
		ReturnTo:  callbackTestRepo,
		ExpiresAt: now.Add(5 * time.Minute),
	}
}

func TestCallbackInvalidStateMakesNoGitHubCall(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	valid := callbackTx(now)
	expired := callbackTx(now)
	expired.ExpiresAt = now.Add(-time.Minute)

	cases := []struct {
		tx    *session.Tx
		name  string
		state string
	}{
		{name: "missing transaction", state: callbackTestState},
		{name: "mismatched state", state: "other-state", tx: &valid},
		{name: "expired transaction", state: callbackTestState, tx: &expired},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			fake := newFakeGitHub(t)
			handler, sealer, _ := newCallbackServer(t, fake, now)
			var cookie *http.Cookie
			if tc.tx != nil {
				cookie = sealedTxCookie(t, sealer, *tc.tx)
			}
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, callbackRequest(tc.state, callbackTestCode, cookie))

			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400", rec.Code)
			}
			if body := decodeJSON(t, rec); body["error"] != invalidStateCode {
				t.Errorf("error = %q, want %q", body["error"], invalidStateCode)
			}
			if fake.requests != 0 {
				t.Errorf("GitHub received %d requests, want 0", fake.requests)
			}
		})
	}
}

func TestCallbackExchangesCodeAndSetsSession(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	fake := newFakeGitHub(t)
	handler, sealer, cfg := newCallbackServer(t, fake, now)
	tx := callbackTx(now)
	tx.ReturnTo = callbackTestTree
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, callbackRequest(tx.State, callbackTestCode, sealedTxCookie(t, sealer, tx)))

	if rec.Code != http.StatusSeeOther {
		t.Fatalf("status = %d, want 303", rec.Code)
	}
	location, err := url.Parse(rec.Header().Get("Location"))
	if err != nil {
		t.Fatalf("parse Location: %v", err)
	}
	if location.Path != tx.ReturnTo {
		t.Errorf("Location path = %q, want %q", location.Path, tx.ReturnTo)
	}
	rawLocation := rec.Header().Get("Location")
	for _, leak := range []string{callbackTestCode, callbackTestAccess, callbackTestRefresh, "code=", "token"} {
		if strings.Contains(rawLocation, leak) {
			t.Errorf("Location %q contains %q", rawLocation, leak)
		}
	}

	if got := fake.exchangeForm.Get("code"); got != callbackTestCode {
		t.Errorf("exchange code = %q, want %q", got, callbackTestCode)
	}
	if got := fake.exchangeForm.Get("code_verifier"); got != tx.Verifier {
		t.Errorf("code_verifier = %q, want %q", got, tx.Verifier)
	}
	if got := fake.exchangeForm.Get("redirect_uri"); got != cfg.CallbackURL() {
		t.Errorf("redirect_uri = %q, want %q", got, cfg.CallbackURL())
	}
	if fake.userAuth != "Bearer "+callbackTestAccess {
		t.Errorf("user Authorization = %q, want Bearer %s", fake.userAuth, callbackTestAccess)
	}

	sess := readSession(t, sealer, rec, now)
	if sess.Login != "octocat" || sess.ID != 42 || sess.Name != "The Octocat" {
		t.Errorf("session identity = %+v", sess)
	}
	if sess.AccessToken != callbackTestAccess || sess.RefreshToken != callbackTestRefresh {
		t.Errorf("session tokens not stored: %+v", sess)
	}
	if !sess.IssuedAt.Equal(now) {
		t.Errorf("IssuedAt = %v, want %v", sess.IssuedAt, now)
	}

	cleared := responseCookie(rec, session.TxCookieName)
	if cleared == nil {
		t.Fatal("transaction cookie was not cleared")
	}
	if cleared.MaxAge != -1 {
		t.Errorf("transaction cookie MaxAge = %d, want -1", cleared.MaxAge)
	}
}

func TestCallbackFailedExchangeRedirectsWithoutSession(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()

	for _, failUser := range []bool{false, true} {
		fake := newFakeGitHub(t)
		fake.failExchange = !failUser
		fake.failUser = failUser
		handler, sealer, _ := newCallbackServer(t, fake, now)
		tx := callbackTx(now)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, callbackRequest(tx.State, callbackTestCode, sealedTxCookie(t, sealer, tx)))

		if rec.Code != http.StatusSeeOther {
			t.Fatalf("status = %d, want 303", rec.Code)
		}
		if got := rec.Header().Get("Location"); got != authErrorLocation {
			t.Errorf("Location = %q, want %q", got, authErrorLocation)
		}
		if responseCookie(rec, session.CookieName) != nil {
			t.Error("failed exchange set a session cookie")
		}
		if cleared := responseCookie(rec, session.TxCookieName); cleared == nil || cleared.MaxAge != -1 {
			t.Error("failed exchange did not clear the transaction cookie")
		}

		body := rec.Body.String()
		for _, leak := range []string{"upstream secret detail", "upstream secret body", "bad_verification_code"} {
			if strings.Contains(body, leak) {
				t.Errorf("response body leaks %q: %s", leak, body)
			}
		}
		var parsed map[string]string
		if err := json.Unmarshal([]byte(body), &parsed); err == nil && len(parsed) > 0 {
			t.Errorf("unexpected JSON body on redirect: %v", parsed)
		}
	}
}
