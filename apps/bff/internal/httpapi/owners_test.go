package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// TestOwnersEndpointListsInstallations checks the owners endpoint returns the
// mapped installation accounts for a signed-in session.
func TestOwnersEndpointListsInstallations(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	fake := &fakeRepoActions{router: func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/user/installations" {
			t.Errorf("path = %q, want /user/installations", r.URL.Path)
		}
		_, _ = w.Write([]byte(`{"installations":[
			{"id":7,"repository_selection":"all","account":{"login":"octocat","type":"User","avatar_url":"https://avatars.example/u/7"}},
			{"id":9,"repository_selection":"selected","account":{"login":"acme","type":"Organization","avatar_url":"https://avatars.example/u/9"}}
		]}`))
	}}
	handler, sealer := newRepoActionsServer(t, fake, now)

	rec := serveRepoAction(t, handler, sealer, now, http.MethodGet, ownersPath, nil)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", rec.Code, rec.Body.String())
	}
	var body []map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if len(body) != 2 {
		t.Fatalf("body = %v, want 2 entries", body)
	}
	if body[0]["login"] != "octocat" || body[0]["type"] != "User" ||
		body[0]["avatarUrl"] != "https://avatars.example/u/7" || body[0]["allRepos"] != true {
		t.Errorf("body[0] = %v", body[0])
	}
	if body[1]["login"] != "acme" || body[1]["type"] != "Organization" ||
		body[1]["avatarUrl"] != "https://avatars.example/u/9" || body[1]["allRepos"] != false {
		t.Errorf("body[1] = %v", body[1])
	}
}

// TestOwnersEndpointRequiresSession checks the owners endpoint answers 401 with
// the unauthenticated JSON code when no session cookie is present.
func TestOwnersEndpointRequiresSession(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	fake := &fakeRepoActions{router: func(w http.ResponseWriter, _ *http.Request) {
		t.Error("GitHub must not be called without a session")
		w.WriteHeader(http.StatusOK)
	}}
	handler, _ := newRepoActionsServer(t, fake, now)

	req := httptest.NewRequest(http.MethodGet, ownersPath, nil)
	req.Header.Set("Origin", reposTestOrigin)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401: %s", rec.Code, rec.Body.String())
	}
	body := decodeAnyJSON(t, rec)
	if body["error"] != unauthenticatedCode {
		t.Errorf("error = %v, want %q", body["error"], unauthenticatedCode)
	}
}
