package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/konsulin-care/opendraft/apps/bff/internal/config"
	"github.com/konsulin-care/opendraft/apps/bff/internal/github"
	"github.com/konsulin-care/opendraft/apps/bff/internal/session"
)

// fakeRepoActions is a fake GitHub endpoint for the repository action routes.
type fakeRepoActions struct {
	router func(w http.ResponseWriter, r *http.Request)
	paths  []string
	bodies []map[string]any
	mu     sync.Mutex
	calls  int
}

func (f *fakeRepoActions) handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		f.mu.Lock()
		f.calls++
		f.paths = append(f.paths, r.URL.Path)
		f.bodies = append(f.bodies, body)
		router := f.router
		f.mu.Unlock()
		router(w, r)
	})
}

func (f *fakeRepoActions) count() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.calls
}

// newRepoActionsServer builds the full BFF handler against a fake GitHub
// server for the repository action tests.
func newRepoActionsServer(t *testing.T, fake *fakeRepoActions, now time.Time) (http.Handler, *session.Sealer) {
	t.Helper()
	server := httptest.NewServer(fake.handler())
	t.Cleanup(server.Close)

	cfg := config.Config{
		PublicOrigin:       reposTestOrigin,
		GitHubClientID:     "client-id",
		GitHubClientSecret: "client-secret",
		GitHubAppSlug:      "opendraft-app",
		GitHubWebURL:       server.URL,
		GitHubAPIURL:       server.URL,
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
			WebURL:       server.URL,
			APIURL:       server.URL,
			ClientID:     cfg.GitHubClientID,
			ClientSecret: cfg.GitHubClientSecret,
			Now:          func() time.Time { return now },
		},
		Sealer: sealer,
	}
	return New(cfg, deps), sealer
}

// serveRepoAction issues an authenticated request with an optional JSON body.
func serveRepoAction(t *testing.T, handler http.Handler, sealer *session.Sealer, now time.Time, method, path string, body map[string]any) *httptest.ResponseRecorder {
	t.Helper()
	var reader *bytes.Reader
	if body == nil {
		reader = bytes.NewReader(nil)
	} else {
		payload, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal body: %v", err)
		}
		reader = bytes.NewReader(payload)
	}
	req := httptest.NewRequest(method, path, reader)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", reposTestOrigin)
	req.AddCookie(sessionCookie(t, sealer, liveSession(now), now))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func TestRepoPermissionsEndpoint(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	fake := &fakeRepoActions{router: func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/repos/octocat/draft":
			_, _ = w.Write([]byte(`{"default_branch":"main","private":false,"permissions":{"push":true}}`))
		case "/user/installations":
			_, _ = w.Write([]byte(`{"installations":[{"id":7,"repository_selection":"all","account":{"login":"octocat"}}]}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}}
	handler, sealer := newRepoActionsServer(t, fake, now)

	rec := serveRepoAction(t, handler, sealer, now, http.MethodGet, "/@api/repos/octocat/draft/permissions", nil)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", rec.Code, rec.Body.String())
	}
	body := decodeAnyJSON(t, rec)
	if body["push"] != true || body["installed"] != true || body["defaultBranch"] != "main" ||
		body["private"] != false || body["allowForking"] != true || body["viewerInstalledAll"] != true {
		t.Fatalf("body = %v", body)
	}
}

func TestRepoPermissionsSelectedRepository(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	fake := &fakeRepoActions{router: func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/repos/acme/paper":
			_, _ = w.Write([]byte(`{"default_branch":"trunk","private":true,"allow_forking":true,"permissions":{"push":false}}`))
		case "/user/installations":
			_, _ = w.Write([]byte(`{"installations":[{"id":9,"repository_selection":"selected","account":{"login":"acme"}},{"id":7,"repository_selection":"all","account":{"login":"OctoCat"}}]}`))
		case "/user/installations/9/repositories":
			_, _ = w.Write([]byte(`{"repositories":[{"full_name":"acme/paper"}]}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}}
	handler, sealer := newRepoActionsServer(t, fake, now)

	rec := serveRepoAction(t, handler, sealer, now, http.MethodGet, "/@api/repos/acme/paper/permissions", nil)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", rec.Code, rec.Body.String())
	}
	body := decodeAnyJSON(t, rec)
	if body["push"] != false || body["installed"] != true || body["defaultBranch"] != "trunk" ||
		body["private"] != true || body["allowForking"] != true || body["viewerInstalledAll"] != true {
		t.Fatalf("body = %v", body)
	}
}

func TestCreatePullEndpoint(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	fake := &fakeRepoActions{router: func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/repos/octocat/draft/pulls" {
			t.Errorf("path = %q", r.URL.Path)
		}
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"number":12,"html_url":"https://github.example/octocat/draft/pull/12"}`))
	}}
	handler, sealer := newRepoActionsServer(t, fake, now)

	rec := serveRepoAction(t, handler, sealer, now, http.MethodPost, "/@api/repos/octocat/draft/pulls", map[string]any{
		"title": "Initialise OpenDraft",
		"head":  "opendraft/init",
		"base":  "main",
		"body":  "Adds the protocol files",
	})

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201: %s", rec.Code, rec.Body.String())
	}
	body := decodeAnyJSON(t, rec)
	if body["number"] != float64(12) {
		t.Errorf("number = %v, want 12", body["number"])
	}
	if body["url"] != "https://github.example/octocat/draft/pull/12" {
		t.Errorf("url = %v", body["url"])
	}
}

func TestCreatePullEndpointRejectsInvalidBodies(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	longTitle := ""
	for len(longTitle) < 257 {
		longTitle += "a"
	}
	tests := []struct {
		name  string
		body  map[string]any
		field string
	}{
		{name: "empty title", body: map[string]any{"title": "", "head": "h", "base": "main"}, field: titleField},
		{name: "long title", body: map[string]any{"title": longTitle, "head": "h", "base": "main"}, field: titleField},
		{name: "invalid head", body: map[string]any{"title": "t", "head": "bad head", "base": "main"}, field: headField},
		{name: "invalid base", body: map[string]any{"title": "t", "head": "h", "base": "bad base"}, field: baseField},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fake := &fakeRepoActions{router: func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(http.StatusCreated)
			}}
			handler, sealer := newRepoActionsServer(t, fake, now)

			rec := serveRepoAction(t, handler, sealer, now, http.MethodPost, "/@api/repos/octocat/draft/pulls", tt.body)

			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400", rec.Code)
			}
			body := decodeJSON(t, rec)
			if body["error"] != invalidRequestCode || body["field"] != tt.field {
				t.Errorf("body = %v, want field %q", body, tt.field)
			}
			if fake.count() != 0 {
				t.Errorf("GitHub received %d requests, want 0", fake.count())
			}
		})
	}
}

func TestCreateForkEndpoint(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	fake := &fakeRepoActions{router: func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/repos/octocat/draft/forks" {
			t.Errorf("path = %q", r.URL.Path)
		}
		w.WriteHeader(http.StatusAccepted)
		_, _ = w.Write([]byte(`{"name":"draft","html_url":"https://github.example/me/draft","default_branch":"main","owner":{"login":"me"}}`))
	}}
	handler, sealer := newRepoActionsServer(t, fake, now)

	rec := serveRepoAction(t, handler, sealer, now, http.MethodPost, "/@api/repos/octocat/draft/forks", nil)

	if rec.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want 202: %s", rec.Code, rec.Body.String())
	}
	body := decodeAnyJSON(t, rec)
	if body["owner"] != "me" || body["repo"] != "draft" || body["defaultBranch"] != "main" {
		t.Fatalf("body = %v", body)
	}
}

func TestRepoActionsRejectInvalidPaths(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	tests := []struct {
		name   string
		method string
		path   string
	}{
		{name: "invalid owner", method: http.MethodGet, path: "/@api/repos/bad_owner/draft/permissions"},
		{name: "invalid repo", method: http.MethodGet, path: "/@api/repos/octocat/bad!repo/permissions"},
		{name: "invalid fork repo", method: http.MethodPost, path: "/@api/repos/octocat/bad!repo/forks"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fake := &fakeRepoActions{router: func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(http.StatusOK)
			}}
			handler, sealer := newRepoActionsServer(t, fake, now)

			rec := serveRepoAction(t, handler, sealer, now, tt.method, tt.path, nil)

			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400: %s", rec.Code, rec.Body.String())
			}
			body := decodeJSON(t, rec)
			if body["error"] != invalidRequestCode {
				t.Errorf("error = %q, want %q", body["error"], invalidRequestCode)
			}
			if fake.count() != 0 {
				t.Errorf("GitHub received %d requests, want 0", fake.count())
			}
		})
	}
}

func TestRepoActionsRequireSession(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	fake := &fakeRepoActions{router: func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}}
	handler, _ := newRepoActionsServer(t, fake, now)
	req := httptest.NewRequest(http.MethodGet, "/@api/repos/octocat/draft/permissions", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
	if fake.count() != 0 {
		t.Errorf("GitHub received %d requests, want 0", fake.count())
	}
}
