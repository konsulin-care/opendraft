package github

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

// actionCall captures one request received by the fake GitHub action endpoint.
type actionCall struct {
	body   map[string]any
	method string
	path   string
	query  string
	auth   string
}

// fakeActions records requests and answers them through a router function.
type fakeActions struct {
	router func(w http.ResponseWriter, r *http.Request)
	calls  []actionCall
	mu     sync.Mutex
}

func (f *fakeActions) handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		f.mu.Lock()
		f.calls = append(f.calls, actionCall{
			method: r.Method,
			path:   r.URL.Path,
			query:  r.URL.RawQuery,
			auth:   r.Header.Get("Authorization"),
			body:   body,
		})
		router := f.router
		f.mu.Unlock()
		router(w, r)
	})
}

func (f *fakeActions) snapshot() []actionCall {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]actionCall, len(f.calls))
	copy(out, f.calls)
	return out
}

func TestRepoPermissionsAllRepositories(t *testing.T) {
	fake := &fakeActions{router: func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case settingsPath:
			_, _ = w.Write([]byte(`{"default_branch":"main","private":false,"permissions":{"push":true}}`))
		case installationsPath:
			_, _ = w.Write([]byte(`{"installations":[{"id":7,"repository_selection":"all","account":{"login":"OctoCat"}}]}`))
		default:
			t.Errorf(unexpectedPath, r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}}
	server := httptest.NewServer(fake.handler())
	t.Cleanup(server.Close)

	perms, err := testClient(server.URL, time.Now()).RepoPermissions(context.Background(), testToken, testOwner, testOwner, testRepo)
	if err != nil {
		t.Fatalf(repoPermissionsFailed, err)
	}
	if !perms.Push || !perms.Installed || perms.DefaultBranch != testDefaultBranch {
		t.Fatalf("got %+v", perms)
	}
	if perms.Private {
		t.Error("Private = true, want false")
	}
	if !perms.AllowForking {
		t.Error("AllowForking = false, want true for a public repository")
	}
	if !perms.ViewerInstalledAll {
		t.Error("ViewerInstalledAll = false, want true")
	}
	calls := fake.snapshot()
	if len(calls) != 2 {
		t.Fatalf("calls = %d, want 2", len(calls))
	}
	if calls[0].auth != testBearer {
		t.Errorf("Authorization = %q", calls[0].auth)
	}
}

func TestRepoPermissionsSelectedRepository(t *testing.T) {
	fake := &fakeActions{router: func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case acmePaperPath:
			_, _ = w.Write([]byte(`{"default_branch":"trunk","private":true,"allow_forking":false,"permissions":{"push":false}}`))
		case installationsPath:
			_, _ = w.Write([]byte(`{"installations":[{"id":9,"repository_selection":"selected","account":{"login":"acme"}},{"id":11,"repository_selection":"all","account":{"login":"viewer"}}]}`))
		case installationReposPath:
			if r.URL.Query().Get("per_page") != "100" || r.URL.Query().Get("page") != "1" {
				t.Errorf("query = %q", r.URL.RawQuery)
			}
			_, _ = w.Write([]byte(`{"repositories":[{"full_name":"acme/other"},{"full_name":"acme/paper"}]}`))
		default:
			t.Errorf(unexpectedPath, r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}}
	server := httptest.NewServer(fake.handler())
	t.Cleanup(server.Close)

	perms, err := testClient(server.URL, time.Now()).RepoPermissions(context.Background(), testToken, testViewer, testOrg, testPaper)
	if err != nil {
		t.Fatalf(repoPermissionsFailed, err)
	}
	if perms.Push {
		t.Error("Push = true, want false")
	}
	if !perms.Installed || perms.DefaultBranch != "trunk" {
		t.Fatalf("got %+v", perms)
	}
	if !perms.Private {
		t.Error("Private = false, want true")
	}
	if perms.AllowForking {
		t.Error("AllowForking = true, want false for a private repository without forking")
	}
	if !perms.ViewerInstalledAll {
		t.Error("ViewerInstalledAll = false, want true")
	}
}

func TestRepoPermissionsNotInstalled(t *testing.T) {
	fake := &fakeActions{router: func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case acmePaperPath:
			_, _ = w.Write([]byte(`{"default_branch":"main","private":true,"allow_forking":true,"permissions":{"push":true}}`))
		case installationsPath:
			_, _ = w.Write([]byte(`{"installations":[{"id":9,"repository_selection":"selected","account":{"login":"acme"}},{"id":8,"repository_selection":"all","account":{"login":"other"}}]}`))
		case installationReposPath:
			_, _ = w.Write([]byte(`{"repositories":[{"full_name":"acme/other"}]}`))
		default:
			t.Errorf(unexpectedPath, r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}}
	server := httptest.NewServer(fake.handler())
	t.Cleanup(server.Close)

	perms, err := testClient(server.URL, time.Now()).RepoPermissions(context.Background(), testToken, testViewer, testOrg, testPaper)
	if err != nil {
		t.Fatalf(repoPermissionsFailed, err)
	}
	if perms.Installed {
		t.Error("Installed = true, want false")
	}
	if !perms.AllowForking {
		t.Error("AllowForking = false, want true for a private repository with forking")
	}
	if perms.ViewerInstalledAll {
		t.Error("ViewerInstalledAll = true, want false")
	}
}

func TestCreatePull(t *testing.T) {
	fake := &fakeActions{router: func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != pullsPath {
			t.Errorf("path = %q", r.URL.Path)
		}
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"number":12,"html_url":"https://github.example/octocat/draft/pull/12"}`))
	}}
	server := httptest.NewServer(fake.handler())
	t.Cleanup(server.Close)

	number, url, err := testClient(server.URL, time.Now()).CreatePull(context.Background(), testToken, testOwner, testRepo, "Init", "opendraft/init", testDefaultBranch, "hello")
	if err != nil {
		t.Fatalf("CreatePull: %v", err)
	}
	if number != 12 || url != pullURL {
		t.Fatalf("number=%d url=%q", number, url)
	}
	calls := fake.snapshot()
	if len(calls) != 1 || calls[0].method != http.MethodPost {
		t.Fatalf("calls = %+v", calls)
	}
	if calls[0].body["head"] != "opendraft/init" || calls[0].body["base"] != testDefaultBranch {
		t.Errorf("body = %+v", calls[0].body)
	}
	if calls[0].body["maintainer_can_modify"] != true {
		t.Errorf("maintainer_can_modify = %v", calls[0].body["maintainer_can_modify"])
	}
}

func TestCreateFork(t *testing.T) {
	fake := &fakeActions{router: func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != forksPath {
			t.Errorf("path = %q", r.URL.Path)
		}
		w.WriteHeader(http.StatusAccepted)
		_, _ = w.Write([]byte(`{"name":"draft","html_url":"https://github.example/me/draft","default_branch":"main","owner":{"login":"me"}}`))
	}}
	server := httptest.NewServer(fake.handler())
	t.Cleanup(server.Close)

	repo, err := testClient(server.URL, time.Now()).CreateFork(context.Background(), testToken, testOwner, testRepo)
	if err != nil {
		t.Fatalf("CreateFork: %v", err)
	}
	want := Repo{Owner: "me", Name: testRepo, HTMLURL: "https://github.example/me/draft", DefaultBranch: testDefaultBranch}
	if repo != want {
		t.Fatalf("repo = %+v, want %+v", repo, want)
	}
	calls := fake.snapshot()
	if calls[0].body["default_branch_only"] != true {
		t.Errorf("default_branch_only = %v", calls[0].body["default_branch_only"])
	}
}

func TestRepoActionStatusMapping(t *testing.T) {
	tests := []struct {
		want   error
		name   string
		status int
	}{
		{name: "unprocessable", status: http.StatusUnprocessableEntity, want: ErrNameTaken},
		{name: "unauthorized", status: http.StatusUnauthorized, want: ErrForbidden},
		{name: "forbidden", status: http.StatusForbidden, want: ErrForbidden},
		{name: "not found", status: http.StatusNotFound, want: ErrForbidden},
		{name: "server error", status: http.StatusInternalServerError, want: ErrUpstream},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(tt.status)
				_, _ = w.Write([]byte(`{"message":"upstream secret detail"}`))
			}))
			t.Cleanup(server.Close)

			_, _, err := testClient(server.URL, time.Now()).CreatePull(context.Background(), testToken, "o", "r", "t", "h", "b", "")
			if !errors.Is(err, tt.want) {
				t.Fatalf("err = %v, want %v", err, tt.want)
			}
			if err != nil && strings.Contains(err.Error(), "secret detail") {
				t.Errorf("error relays upstream body: %v", err)
			}
		})
	}
}
