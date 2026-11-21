package github

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// repoCall captures one request received by the fake GitHub repo endpoint.
type repoCall struct {
	method  string
	path    string
	auth    string
	accept  string
	version string
	agent   string
	body    createRepoRequest
}

func TestCreateRepoForUser(t *testing.T) {
	var call repoCall
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		call.method = r.Method
		call.path = r.URL.Path
		call.auth = r.Header.Get("Authorization")
		call.accept = r.Header.Get("Accept")
		call.version = r.Header.Get("X-GitHub-Api-Version")
		call.agent = r.Header.Get("User-Agent")
		if err := json.NewDecoder(r.Body).Decode(&call.body); err != nil {
			t.Errorf("decode request body: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"name":"draft","html_url":"https://github.example/octocat/draft","default_branch":"main","owner":{"login":"octocat"}}`))
	}))
	t.Cleanup(server.Close)

	client := testClient(server.URL, time.Now())
	repo, err := client.CreateRepo(context.Background(), "ghu_token", "octocat", true, "draft", "A draft", false)
	if err != nil {
		t.Fatalf("CreateRepo: %v", err)
	}

	if call.method != http.MethodPost {
		t.Errorf("method = %q, want POST", call.method)
	}
	if call.path != "/user/repos" {
		t.Errorf("path = %q, want /user/repos", call.path)
	}
	if call.auth != "Bearer ghu_token" {
		t.Errorf("Authorization = %q, want Bearer token", call.auth)
	}
	if call.accept != "application/vnd.github+json" {
		t.Errorf("Accept = %q", call.accept)
	}
	if call.version != "2022-11-28" {
		t.Errorf("X-GitHub-Api-Version = %q", call.version)
	}
	if call.agent != "opendraft-bff" {
		t.Errorf("User-Agent = %q", call.agent)
	}
	if call.body.Name != "draft" || call.body.Description != "A draft" {
		t.Errorf("body = %+v", call.body)
	}
	if call.body.Private {
		t.Error("private = true, want false")
	}
	if call.body.AutoInit {
		t.Error("auto_init = true, want false")
	}

	want := Repo{Owner: "octocat", Name: "draft", HTMLURL: "https://github.example/octocat/draft", DefaultBranch: "main"}
	if repo != want {
		t.Errorf("repo = %+v, want %+v", repo, want)
	}
}

func TestCreateRepoForOrg(t *testing.T) {
	var call repoCall
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		call.path = r.URL.Path
		_ = json.NewDecoder(r.Body).Decode(&call.body)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"name":"draft","html_url":"https://github.example/acme/draft","default_branch":"trunk","owner":{"login":"acme"}}`))
	}))
	t.Cleanup(server.Close)

	client := testClient(server.URL, time.Now())
	repo, err := client.CreateRepo(context.Background(), "ghu_token", "acme", false, "draft", "", true)
	if err != nil {
		t.Fatalf("CreateRepo: %v", err)
	}

	if call.path != "/orgs/acme/repos" {
		t.Errorf("path = %q, want /orgs/acme/repos", call.path)
	}
	if !call.body.Private {
		t.Error("private = false, want true")
	}
	if repo.Owner != "acme" || repo.DefaultBranch != "trunk" {
		t.Errorf("repo = %+v", repo)
	}
}

func TestCreateRepoStatusMapping(t *testing.T) {
	tests := []struct {
		name   string
		status int
		want   error
	}{
		{name: "name taken", status: http.StatusUnprocessableEntity, want: ErrNameTaken},
		{name: "unauthorized", status: http.StatusUnauthorized, want: ErrForbidden},
		{name: "forbidden", status: http.StatusForbidden, want: ErrForbidden},
		{name: "not found", status: http.StatusNotFound, want: ErrForbidden},
		{name: "server error", status: http.StatusInternalServerError, want: ErrUpstream},
		{name: "bad gateway", status: http.StatusBadGateway, want: ErrUpstream},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(tt.status)
				_, _ = w.Write([]byte(`{"message":"upstream secret detail"}`))
			}))
			t.Cleanup(server.Close)

			client := testClient(server.URL, time.Now())
			_, err := client.CreateRepo(context.Background(), "ghu_token", "octocat", true, "draft", "", false)
			if !errors.Is(err, tt.want) {
				t.Fatalf("err = %v, want %v", err, tt.want)
			}
			if err != nil && strings.Contains(err.Error(), "secret detail") {
				t.Errorf("error relays upstream body: %v", err)
			}
		})
	}
}
