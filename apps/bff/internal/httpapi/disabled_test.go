package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/konsulin-care/opendraft/apps/bff/internal/config"
)

// newDisabledServer builds the BFF handler without a GitHub client and without
// a sealer, which is the anonymous read-only mode.
func newDisabledServer(t *testing.T) http.Handler {
	t.Helper()
	return New(config.Config{}, Deps{Now: func() time.Time { return time.Unix(0, 0) }})
}

func TestDisabledGatedRoutesAnswerLoginDisabled(t *testing.T) {
	handler := newDisabledServer(t)

	cases := []struct {
		method string
		target string
	}{
		{http.MethodGet, "/@api/auth/login"},
		{http.MethodGet, "/@api/auth/install"},
		{http.MethodGet, "/@api/auth/callback"},
		{http.MethodPost, "/@api/auth/logout"},
		{http.MethodPost, "/@api/repos"},
		{http.MethodGet, "/@api/repos/owner/repo/permissions"},
		{http.MethodGet, "/@api/git/owner/repo.git/info/refs?service=git-upload-pack"},
	}

	for _, tc := range cases {
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest(tc.method, tc.target, nil))

		if rec.Code != http.StatusForbidden {
			t.Errorf("%s %s status = %d, want 403", tc.method, tc.target, rec.Code)
			continue
		}
		body := decodeJSON(t, rec)
		if body["error"] != loginDisabledCode {
			t.Errorf("%s %s error = %q, want %q", tc.method, tc.target, body["error"], loginDisabledCode)
		}
	}
}

func TestDisabledSessionReportsLoginDisabled(t *testing.T) {
	handler := newDisabledServer(t)

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, sessionPath, nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var body struct {
		LoginEnabled bool `json:"loginEnabled"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.LoginEnabled {
		t.Error("loginEnabled = true, want false")
	}
}

func TestEnabledRoutesKeepNormalBehaviour(t *testing.T) {
	handler, _, _ := newAuthServer(t)

	sessionRec := httptest.NewRecorder()
	handler.ServeHTTP(sessionRec, httptest.NewRequest(http.MethodGet, sessionPath, nil))
	if sessionRec.Code != http.StatusUnauthorized {
		t.Fatalf("session status = %d, want 401", sessionRec.Code)
	}
	if body := decodeJSON(t, sessionRec); body["error"] != unauthenticatedCode {
		t.Errorf("session error = %q, want %q", body["error"], unauthenticatedCode)
	}

	loginRec := httptest.NewRecorder()
	handler.ServeHTTP(loginRec, httptest.NewRequest(http.MethodGet, loginPath, nil))
	if loginRec.Code != http.StatusFound {
		t.Fatalf("login status = %d, want 302", loginRec.Code)
	}
	if location := loginRec.Header().Get("Location"); location == "" {
		t.Error("login Location is empty, want authorize URL")
	}
}
