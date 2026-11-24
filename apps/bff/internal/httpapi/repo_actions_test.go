package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

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
	return newGitHubBackedServer(t, server.URL, now)
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
		case testRepoPath:
			_, _ = w.Write([]byte(`{"default_branch":"main","private":false,"permissions":{"push":true}}`))
		case installationsPath:
			_, _ = w.Write([]byte(`{"installations":[{"id":7,"repository_selection":"all","account":{"login":"octocat"}}]}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}}
	handler, sealer := newRepoActionsServer(t, fake, now)

	rec := serveRepoAction(t, handler, sealer, now, http.MethodGet, testPermissionsAPIPath, nil)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", rec.Code, rec.Body.String())
	}
	body := decodeAnyJSON(t, rec)
	if body["push"] != true || body["installed"] != true || body["defaultBranch"] != testDefaultBranch ||
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
		case installationsPath:
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
		if r.URL.Path != testPullsPath {
			t.Errorf("path = %q", r.URL.Path)
		}
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"number":12,"html_url":"https://github.example/octocat/draft/pull/12"}`))
	}}
	handler, sealer := newRepoActionsServer(t, fake, now)

	rec := serveRepoAction(t, handler, sealer, now, http.MethodPost, testPullsAPIPath, map[string]any{
		titleField: "Initialise OpenDraft",
		headField:  "opendraft/init",
		baseField:  testDefaultBranch,
		"body":     "Adds the protocol files",
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
	longTitle := strings.Repeat("a", maxTitleLength+1)
	tests := []struct {
		name  string
		body  map[string]any
		field string
	}{
		{name: "empty title", body: map[string]any{titleField: "", headField: "h", baseField: testDefaultBranch}, field: titleField},
		{name: "long title", body: map[string]any{titleField: longTitle, headField: "h", baseField: testDefaultBranch}, field: titleField},
		{name: "invalid head", body: map[string]any{titleField: "t", headField: "bad head", baseField: testDefaultBranch}, field: headField},
		{name: "invalid base", body: map[string]any{titleField: "t", headField: "h", baseField: "bad base"}, field: baseField},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assertRejectedRepoActionBody(t, now, http.MethodPost, testPullsAPIPath, tt.body, tt.field)
		})
	}
}

func TestCreateForkEndpoint(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	fake := &fakeRepoActions{router: func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != testRepoPath+"/forks" {
			t.Errorf("path = %q", r.URL.Path)
		}
		w.WriteHeader(http.StatusAccepted)
		_, _ = w.Write([]byte(`{"name":"draft","html_url":"https://github.example/me/draft","default_branch":"main","owner":{"login":"me"}}`))
	}}
	handler, sealer := newRepoActionsServer(t, fake, now)

	rec := serveRepoAction(t, handler, sealer, now, http.MethodPost, testRepoAPIPath+"/forks", nil)

	if rec.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want 202: %s", rec.Code, rec.Body.String())
	}
	body := decodeAnyJSON(t, rec)
	if body["owner"] != "me" || body["repo"] != testRepo || body["defaultBranch"] != testDefaultBranch {
		t.Fatalf("body = %v", body)
	}
}

func TestRepoActionsRejectInvalidPaths(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	tests := []struct {
		name   string
		method string
		path   string
		field  string
	}{
		{name: testInvalidOwner, method: http.MethodGet, path: "/@api/repos/bad_owner/" + testRepo + "/permissions", field: ownerField},
		{name: "invalid repo", method: http.MethodGet, path: "/@api/repos/" + testOwner + "/bad!repo/permissions", field: repoField},
		{name: "invalid fork repo", method: http.MethodPost, path: "/@api/repos/" + testOwner + "/bad!repo/forks", field: repoField},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assertRejectedRepoAction(t, now, tt.method, tt.path, tt.field)
		})
	}
}

func TestRepoActionsRequireSession(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	fake := &fakeRepoActions{router: func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}}
	handler, _ := newRepoActionsServer(t, fake, now)
	req := httptest.NewRequest(http.MethodGet, testPermissionsAPIPath, nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
	if fake.count() != 0 {
		t.Errorf("GitHub received %d requests, want 0", fake.count())
	}
}
