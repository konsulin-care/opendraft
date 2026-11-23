package httpapi

import (
	"net/http"
	"net/http/httptest"
	"net/url"
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

type fakeGitHub struct {
	server        *httptest.Server
	exchangeForm  url.Values
	userAuth      string
	mu            sync.Mutex
	requests      int
	failExchange  bool
	exchangeError string
	failUser      bool
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
				code := "bad_verification_code"
				if f.exchangeError != "" {
					code = f.exchangeError
				}
				_, _ = w.Write([]byte(`{"error":"` + code + `","error_description":"upstream secret detail"}`))
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
		Now:    func() time.Time { return now },
		Sealer: sealer,
		GitHub: &github.Client{
			WebURL:       cfg.GitHubWebURL,
			APIURL:       cfg.GitHubAPIURL,
			ClientID:     cfg.GitHubClientID,
			ClientSecret: cfg.GitHubClientSecret,
			Now:          func() time.Time { return now },
		},
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

func serveCallback(t *testing.T, fake *fakeGitHub, now time.Time, returnTo string) (*httptest.ResponseRecorder, *session.Sealer) {
	t.Helper()

	handler, sealer, _ := newCallbackServer(t, fake, now)
	tx := callbackTx(now)
	tx.ReturnTo = returnTo
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, callbackRequest(tx.State, callbackTestCode, sealedTxCookie(t, sealer, tx)))
	return rec, sealer
}

func assertNoSession(t *testing.T, rec *httptest.ResponseRecorder, failure string) {
	t.Helper()

	if responseCookie(rec, session.CookieName) != nil {
		t.Errorf("%s set a session cookie", failure)
	}
	if cleared := responseCookie(rec, session.TxCookieName); cleared == nil || cleared.MaxAge != -1 {
		t.Errorf("%s did not clear the transaction cookie", failure)
	}
}
