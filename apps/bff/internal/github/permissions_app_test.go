package github

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// writeJSON encodes v and writes it to w.
func writeJSON(t *testing.T, w http.ResponseWriter, v any) {
	t.Helper()
	w.Header().Set("Content-Type", testContentType)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		t.Errorf("encode response: %v", err)
	}
}

// TestRepoPermissionsAppInstallationOverridesUserList checks that with an app
// private key configured, installed comes from the repository installation
// endpoint even when the viewer's installation list lacks the owner.
func TestRepoPermissionsAppInstallationOverridesUserList(t *testing.T) {
	fake := &fakeActions{router: func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case settingsPath:
			_, _ = w.Write([]byte(`{"default_branch":"main","private":false,"permissions":{"push":true}}`))
		case installationsPath:
			_, _ = w.Write([]byte(`{"installations":[{"id":9,"repository_selection":"selected","account":{"login":"acme"}}]}`))
		case settingsPath + "/installation":
			writeJSON(t, w, map[string]any{"id": 42})
		case installationReposPath:
			t.Errorf("per-installation repository listing must be skipped with an app key")
			w.WriteHeader(http.StatusNotFound)
		default:
			t.Errorf(unexpectedPath, r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}}
	server := httptest.NewServer(fake.handler())
	t.Cleanup(server.Close)

	client := testClient(server.URL, time.Now())
	client.AppKey = newAppKey(t)
	perms, err := client.RepoPermissions(context.Background(), testToken, testViewer, testOwner, testRepo)
	if err != nil {
		t.Fatalf(repoPermissionsFailed, err)
	}
	if !perms.Installed {
		t.Error("Installed = false, want true from the app installation endpoint")
	}
	if perms.ViewerInstalledAll {
		t.Error("ViewerInstalledAll = true, want false")
	}
}

// TestRepoPermissionsWithoutAppKeyUsesUserList checks that without an app
// private key installed keeps deriving from the owner's user-visible
// installation.
func TestRepoPermissionsWithoutAppKeyUsesUserList(t *testing.T) {
	fake := &fakeActions{router: func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case settingsPath:
			_, _ = w.Write([]byte(`{"default_branch":"main","private":false,"permissions":{"push":true}}`))
		case installationsPath:
			_, _ = w.Write([]byte(`{"installations":[{"id":9,"repository_selection":"selected","account":{"login":"octocat"}}]}`))
		case installationReposPath:
			_, _ = w.Write([]byte(`{"repositories":[{"full_name":"octocat/draft"}]}`))
		case settingsPath + "/installation":
			t.Errorf("app installation endpoint must not be called without an app key")
			w.WriteHeader(http.StatusNotFound)
		default:
			t.Errorf(unexpectedPath, r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}}
	server := httptest.NewServer(fake.handler())
	t.Cleanup(server.Close)

	perms, err := testClient(server.URL, time.Now()).RepoPermissions(context.Background(), testToken, testViewer, testOwner, testRepo)
	if err != nil {
		t.Fatalf(repoPermissionsFailed, err)
	}
	if !perms.Installed {
		t.Error("Installed = false, want true from the owner's user-visible installation")
	}
}

// TestRepoPermissionsReadsInstallationPages checks that the user installation
// list is read page by page and a viewer installation on page 2 is honoured.
func TestRepoPermissionsReadsInstallationPages(t *testing.T) {
	firstPage := make([]installation, 0, 100)
	for i := 0; i < 100; i++ {
		inst := installation{ID: int64(i + 1), RepositorySelection: "selected"}
		inst.Account.Login = "someone"
		firstPage = append(firstPage, inst)
	}
	secondPage := []installation{{ID: 200, RepositorySelection: "all"}}
	secondPage[0].Account.Login = testViewer

	fake := &fakeActions{router: func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case settingsPath:
			_, _ = w.Write([]byte(`{"default_branch":"main","private":false,"permissions":{"push":true}}`))
		case installationsPath:
			page := r.URL.Query().Get("page")
			if r.URL.Query().Get("per_page") != "100" {
				t.Errorf("per_page = %q, want 100", r.URL.Query().Get("per_page"))
			}
			switch page {
			case "1":
				writeJSON(t, w, installationList{Installations: firstPage})
			case "2":
				writeJSON(t, w, installationList{Installations: secondPage})
			default:
				t.Errorf("unexpected page %q", page)
				w.WriteHeader(http.StatusNotFound)
			}
		default:
			t.Errorf(unexpectedPath, r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}}
	server := httptest.NewServer(fake.handler())
	t.Cleanup(server.Close)

	perms, err := testClient(server.URL, time.Now()).RepoPermissions(context.Background(), testToken, testViewer, testOwner, testRepo)
	if err != nil {
		t.Fatalf(repoPermissionsFailed, err)
	}
	if !perms.ViewerInstalledAll {
		t.Error("ViewerInstalledAll = false, want true from page 2")
	}

	calls := fake.snapshot()
	var installationCalls int
	for _, call := range calls {
		if call.path == installationsPath {
			installationCalls++
		}
	}
	if installationCalls != 2 {
		t.Fatalf("installation list calls = %d, want 2", installationCalls)
	}
}
