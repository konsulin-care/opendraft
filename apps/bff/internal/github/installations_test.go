package github

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// installationCall captures one request received by the fake installation
// endpoint.
type installationCall struct {
	path    string
	auth    string
	accept  string
	version string
}

// TestRepoInstalledTrueOn200 checks the happy path: the app JWT is sent as the
// bearer token and HTTP 200 reports the app as installed.
func TestRepoInstalledTrueOn200(t *testing.T) {
	var got installationCall
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = installationCall{
			path:    r.URL.Path,
			auth:    r.Header.Get("Authorization"),
			accept:  r.Header.Get("Accept"),
			version: r.Header.Get("X-GitHub-Api-Version"),
		}
		w.Header().Set("Content-Type", testContentType)
		_, _ = w.Write([]byte(`{"id":9}`))
	}))
	defer srv.Close()

	client := &Client{
		APIURL:   srv.URL,
		ClientID: testClientID,
		AppKey:   newAppKey(t),
		Now:      func() time.Time { return time.Unix(1700000000, 0) },
	}

	installed, err := client.RepoInstalled(context.Background(), testOwner, testRepo)
	if err != nil {
		t.Fatalf("RepoInstalled: %v", err)
	}
	if !installed {
		t.Fatal("installed = false, want true")
	}

	wantPath := settingsPath + "/installation"
	if got.path != wantPath {
		t.Fatalf("path = %q, want %q", got.path, wantPath)
	}
	const bearerPrefix = "Bearer "
	if !strings.HasPrefix(got.auth, bearerPrefix) {
		t.Fatalf("Authorization = %q, want Bearer prefix", got.auth)
	}
	if segments := strings.Count(strings.TrimPrefix(got.auth, bearerPrefix), "."); segments != 2 {
		t.Fatalf("Authorization = %q, want app JWT with 3 segments", got.auth)
	}
	if got.accept != "application/vnd.github+json" {
		t.Fatalf("Accept = %q", got.accept)
	}
	if got.version != "2022-11-28" {
		t.Fatalf("X-GitHub-Api-Version = %q", got.version)
	}
}

// TestRepoInstalledFalseOn404 checks that HTTP 404 means not installed and is
// not an error.
func TestRepoInstalledFalseOn404(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()

	client := &Client{APIURL: srv.URL, ClientID: testClientID, AppKey: newAppKey(t)}

	installed, err := client.RepoInstalled(context.Background(), testOwner, testRepo)
	if err != nil {
		t.Fatalf("RepoInstalled: %v", err)
	}
	if installed {
		t.Fatal("installed = true, want false")
	}
}

// TestRepoInstalledUpstreamError checks that unexpected statuses wrap
// ErrUpstream.
func TestRepoInstalledUpstreamError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	client := &Client{APIURL: srv.URL, ClientID: testClientID, AppKey: newAppKey(t)}

	installed, err := client.RepoInstalled(context.Background(), testOwner, testRepo)
	if err == nil {
		t.Fatal("RepoInstalled err = nil, want upstream error")
	}
	if !errors.Is(err, ErrUpstream) {
		t.Fatalf("RepoInstalled err = %v, want ErrUpstream", err)
	}
	if installed {
		t.Fatal("installed = true, want false")
	}
}
