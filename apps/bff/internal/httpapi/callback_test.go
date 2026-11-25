package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/konsulin-care/opendraft/apps/bff/internal/session"
)

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
			if body := decodeJSON(t, rec); body[errorKey] != invalidStateCode {
				t.Errorf("error = %q, want %q", body[errorKey], invalidStateCode)
			}
			if fake.requests != 0 {
				t.Errorf("GitHub received %d requests, want 0", fake.requests)
			}
		})
	}
}

// assertCallbackRedirect checks the callback answers a 303 to returnTo without
// leaking codes or tokens in the Location header.
func assertCallbackRedirect(t *testing.T, rec *httptest.ResponseRecorder, returnTo string) {
	t.Helper()

	if rec.Code != http.StatusSeeOther {
		t.Fatalf("status = %d, want 303", rec.Code)
	}
	location, err := url.Parse(rec.Header().Get("Location"))
	if err != nil {
		t.Fatalf("parse Location: %v", err)
	}
	if location.Path != returnTo {
		t.Errorf("Location path = %q, want %q", location.Path, returnTo)
	}
	rawLocation := rec.Header().Get("Location")
	for _, leak := range []string{callbackTestCode, callbackTestAccess, callbackTestRefresh, "code=", "token"} {
		if strings.Contains(rawLocation, leak) {
			t.Errorf("Location %q contains %q", rawLocation, leak)
		}
	}
}

// assertExchangeForm checks the code exchange carried the code, PKCE verifier
// and callback URL, and the user lookup used the access token.
func assertExchangeForm(t *testing.T, fake *fakeGitHub) {
	t.Helper()

	if got := fake.exchangeForm.Get("code"); got != callbackTestCode {
		t.Errorf("exchange code = %q, want %q", got, callbackTestCode)
	}
	if got := fake.exchangeForm.Get("code_verifier"); got != callbackTestVerifier {
		t.Errorf("code_verifier = %q, want %q", got, callbackTestVerifier)
	}
	if got := fake.exchangeForm.Get("redirect_uri"); got != testPublicOrigin+callbackPath {
		t.Errorf("redirect_uri = %q", got)
	}
	if fake.userAuth != "Bearer "+callbackTestAccess {
		t.Errorf("user Authorization = %q, want Bearer %s", fake.userAuth, callbackTestAccess)
	}
}

// assertCallbackSession checks the sealed session holds the GitHub identity and
// exchanged tokens.
func assertCallbackSession(t *testing.T, sess session.Session, now time.Time) {
	t.Helper()

	if sess.Login != testOwner || sess.ID != 42 || sess.Name != testFullName {
		t.Errorf("session identity = %+v", sess)
	}
	if sess.AccessToken != callbackTestAccess || sess.RefreshToken != callbackTestRefresh {
		t.Errorf("session tokens not stored: %+v", sess)
	}
	if !sess.IssuedAt.Equal(now) {
		t.Errorf("IssuedAt = %v, want %v", sess.IssuedAt, now)
	}
}

// assertTxCleared checks the transaction cookie was expired.
func assertTxCleared(t *testing.T, rec *httptest.ResponseRecorder) {
	t.Helper()

	cleared := responseCookie(rec, session.TxCookieName)
	if cleared == nil {
		t.Fatal("transaction cookie was not cleared")
	}
	if cleared.MaxAge != -1 {
		t.Errorf("transaction cookie MaxAge = %d, want -1", cleared.MaxAge)
	}
}

func TestCallbackExchangesCodeAndSetsSession(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	fake := newFakeGitHub(t)
	rec, sealer := serveCallback(t, fake, now, callbackTestTree)

	assertCallbackRedirect(t, rec, callbackTestTree)
	assertExchangeForm(t, fake)
	assertCallbackSession(t, readSession(t, sealer, rec, now), now)
	assertTxCleared(t, rec)
}

func TestCallbackUnverifiedEmailRedirectsToReturnTo(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	for _, returnTo := range []string{callbackTestRepo, callbackTestRepo + "?intent=edit"} {
		fake := newFakeGitHub(t)
		fake.failExchange = true
		fake.exchangeError = "unverified_user_email"
		rec, _ := serveCallback(t, fake, now, returnTo)

		if rec.Code != http.StatusSeeOther {
			t.Fatalf("status = %d, want 303", rec.Code)
		}
		location, err := url.Parse(rec.Header().Get("Location"))
		if err != nil {
			t.Fatalf("parse Location: %v", err)
		}
		if location.Path != callbackTestRepo {
			t.Errorf("Location path = %q, want %q", location.Path, callbackTestRepo)
		}
		query := location.Query()
		if got := query.Get("auth_error"); got != unverifiedEmail {
			t.Errorf("auth_error = %q, want %s", got, unverifiedEmail)
		}
		if returnTo == callbackTestRepo+"?intent=edit" && query.Get("intent") != "edit" {
			t.Errorf("existing query lost: %q", location.RawQuery)
		}
		assertNoSession(t, rec, "unverified email")
	}
}

func TestCallbackFailedExchangeRedirectsWithoutSession(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	for _, failUser := range []bool{false, true} {
		fake := newFakeGitHub(t)
		fake.failExchange = !failUser
		fake.failUser = failUser
		rec, _ := serveCallback(t, fake, now, callbackTestRepo)

		if rec.Code != http.StatusSeeOther {
			t.Fatalf("status = %d, want 303", rec.Code)
		}
		if got := rec.Header().Get("Location"); got != authErrorLocation {
			t.Errorf("Location = %q, want %q", got, authErrorLocation)
		}
		assertNoSession(t, rec, "failed exchange")

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
