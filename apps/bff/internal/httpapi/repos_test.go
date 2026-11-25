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

// fakeRepos is a fake GitHub repo creation endpoint.
type fakeRepos struct {
	server   *httptest.Server
	response string
	paths    []string
	bodies   []map[string]any
	mu       sync.Mutex
	requests int
	status   int
}

func newFakeRepos(t *testing.T) *fakeRepos {
	t.Helper()
	f := &fakeRepos{
		status:   http.StatusCreated,
		response: `{"name":"draft","html_url":"https://github.example/octocat/draft","default_branch":"main","owner":{"login":"octocat"}}`,
	}
	f.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		f.requests++
		f.paths = append(f.paths, r.URL.Path)
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		f.bodies = append(f.bodies, body)
		status := f.status
		response := f.response
		f.mu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = w.Write([]byte(response))
	}))
	t.Cleanup(f.server.Close)
	return f
}

// newReposServer builds the full BFF handler against a fake GitHub server.
func newReposServer(t *testing.T, fake *fakeRepos, now time.Time) (http.Handler, *session.Sealer) {
	t.Helper()
	return newGitHubBackedServer(t, fake.server.URL, now)
}

// postRepo issues an authenticated POST /@api/repos request with body.
func postRepo(t *testing.T, handler http.Handler, sealer *session.Sealer, now time.Time, body map[string]any) *httptest.ResponseRecorder {
	t.Helper()
	payload, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal body: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, reposPath, bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", reposTestOrigin)
	req.AddCookie(sessionCookie(t, sealer, liveSession(now), now))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func TestCreateRepoRejectsInvalidRequestsBeforeGitHub(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	tests := []struct {
		body  map[string]any
		name  string
		field string
	}{
		{name: "invalid name", body: map[string]any{ownerField: testOwner, nameField: "bad name!", visibilityField: testPublicVisibility}, field: nameField},
		{name: "dot name", body: map[string]any{ownerField: testOwner, nameField: ".", visibilityField: testPublicVisibility}, field: nameField},
		{name: "dot dot name", body: map[string]any{ownerField: testOwner, nameField: "..", visibilityField: testPublicVisibility}, field: nameField},
		{name: "missing owner", body: map[string]any{nameField: testRepo, visibilityField: testPublicVisibility}, field: ownerField},
		{name: testInvalidOwner, body: map[string]any{ownerField: testInvalidOwner, nameField: testRepo, visibilityField: testPublicVisibility}, field: ownerField},
		{name: "invalid visibility", body: map[string]any{ownerField: testOwner, nameField: testRepo, visibilityField: "internal"}, field: visibilityField},
		{name: "missing visibility", body: map[string]any{ownerField: testOwner, nameField: testRepo}, field: visibilityField},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fake := newFakeRepos(t)
			handler, sealer := newReposServer(t, fake, now)

			rec := postRepo(t, handler, sealer, now, tt.body)

			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400", rec.Code)
			}
			body := decodeJSON(t, rec)
			if body[errorKey] != invalidRequestCode {
				t.Errorf("error = %q, want %q", body[errorKey], invalidRequestCode)
			}
			if body["field"] != tt.field {
				t.Errorf("field = %q, want %q", body["field"], tt.field)
			}
			if fake.requests != 0 {
				t.Errorf("GitHub received %d requests, want 0", fake.requests)
			}
		})
	}
}

func TestCreateRepoForSessionUser(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	fake := newFakeRepos(t)
	handler, sealer := newReposServer(t, fake, now)

	rec := postRepo(t, handler, sealer, now, map[string]any{
		ownerField:      "OctoCat",
		nameField:       testRepo,
		visibilityField: testPublicVisibility,
		"description":   "A draft",
	})

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201: %s", rec.Code, rec.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	want := map[string]string{
		ownerField:      testOwner,
		nameField:       testRepo,
		"htmlUrl":       "https://github.example/octocat/draft",
		"defaultBranch": testDefaultBranch,
	}
	for key, value := range want {
		if body[key] != value {
			t.Errorf("%s = %v, want %v", key, body[key], value)
		}
	}

	fake.mu.Lock()
	defer fake.mu.Unlock()
	if len(fake.paths) != 1 || fake.paths[0] != "/user/repos" {
		t.Fatalf("paths = %v, want [/user/repos]", fake.paths)
	}
	if got := fake.bodies[0]["private"]; got != false {
		t.Errorf("private = %v, want false", got)
	}
	if got := fake.bodies[0]["auto_init"]; got != false {
		t.Errorf("auto_init = %v, want false", got)
	}
	if got := fake.bodies[0]["description"]; got != "A draft" {
		t.Errorf("description = %v, want A draft", got)
	}
}

func TestCreateRepoForOrgIsPrivate(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	fake := newFakeRepos(t)
	fake.response = `{"name":"draft","html_url":"https://github.example/acme/draft","default_branch":"main","owner":{"login":"acme"}}`
	handler, sealer := newReposServer(t, fake, now)

	rec := postRepo(t, handler, sealer, now, map[string]any{
		ownerField:      "acme",
		nameField:       testRepo,
		visibilityField: testPrivateVisibility,
	})

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201: %s", rec.Code, rec.Body.String())
	}

	fake.mu.Lock()
	defer fake.mu.Unlock()
	if len(fake.paths) != 1 || fake.paths[0] != "/orgs/acme/repos" {
		t.Fatalf("paths = %v, want [/orgs/acme/repos]", fake.paths)
	}
	if got := fake.bodies[0]["private"]; got != true {
		t.Errorf("private = %v, want true", got)
	}
}

func TestCreateRepoErrorMapping(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	tests := []struct {
		name       string
		wantCode   string
		status     int
		wantStatus int
	}{
		{name: "name taken", status: http.StatusUnprocessableEntity, wantStatus: http.StatusConflict, wantCode: nameTakenCode},
		{name: "forbidden", status: http.StatusForbidden, wantStatus: http.StatusForbidden, wantCode: forbiddenCode},
		{name: "not found", status: http.StatusNotFound, wantStatus: http.StatusForbidden, wantCode: forbiddenCode},
		{name: "upstream", status: http.StatusInternalServerError, wantStatus: http.StatusBadGateway, wantCode: upstreamErrorCode},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fake := newFakeRepos(t)
			fake.status = tt.status
			fake.response = `{"message":"upstream secret detail"}`
			handler, sealer := newReposServer(t, fake, now)

			rec := postRepo(t, handler, sealer, now, map[string]any{
				ownerField:      testOwner,
				nameField:       testRepo,
				visibilityField: testPublicVisibility,
			})

			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d", rec.Code, tt.wantStatus)
			}
			body := decodeJSON(t, rec)
			if body[errorKey] != tt.wantCode {
				t.Errorf("error = %q, want %q", body[errorKey], tt.wantCode)
			}
			if strings.Contains(rec.Body.String(), "secret detail") {
				t.Errorf("response relays upstream body: %s", rec.Body.String())
			}
		})
	}
}

func TestCreateRepoRequiresSession(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	fake := newFakeRepos(t)
	handler, _ := newReposServer(t, fake, now)

	payload := []byte(`{"owner":"octocat","name":"draft","visibility":"public"}`)
	req := httptest.NewRequest(http.MethodPost, reposPath, bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", reposTestOrigin)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
	if fake.requests != 0 {
		t.Errorf("GitHub received %d requests, want 0", fake.requests)
	}
}
