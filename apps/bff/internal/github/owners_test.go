package github

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestListOwnersMapsInstallations(t *testing.T) {
	fake := &fakeActions{router: func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != installationsPath {
			t.Errorf("path = %q, want %s", r.URL.Path, installationsPath)
		}
		_, _ = w.Write([]byte(`{"installations":[
			{"id":7,"repository_selection":"all","account":{"login":"octocat","type":"User","avatar_url":"https://avatars.example/u/7"}},
			{"id":9,"repository_selection":"selected","account":{"login":"acme","type":"Organization","avatar_url":"https://avatars.example/u/9"}}
		]}`))
	}}
	server := httptest.NewServer(fake.handler())
	t.Cleanup(server.Close)

	owners, err := testClient(server.URL, time.Now()).ListOwners(context.Background(), testToken)
	if err != nil {
		t.Fatalf("ListOwners: %v", err)
	}
	want := []Owner{
		{Login: testOwner, Type: "User", AvatarURL: "https://avatars.example/u/7", AllRepos: true},
		{Login: testOrg, Type: "Organization", AvatarURL: "https://avatars.example/u/9", AllRepos: false},
	}
	if len(owners) != len(want) {
		t.Fatalf("owners = %+v, want %+v", owners, want)
	}
	for i := range want {
		if owners[i] != want[i] {
			t.Errorf("owners[%d] = %+v, want %+v", i, owners[i], want[i])
		}
	}
	calls := fake.snapshot()
	if len(calls) != 1 || calls[0].auth != testBearer {
		t.Fatalf("calls = %+v", calls)
	}
}

func TestListOwnersEmpty(t *testing.T) {
	fake := &fakeActions{router: func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"installations":[]}`))
	}}
	server := httptest.NewServer(fake.handler())
	t.Cleanup(server.Close)

	owners, err := testClient(server.URL, time.Now()).ListOwners(context.Background(), testToken)
	if err != nil {
		t.Fatalf("ListOwners: %v", err)
	}
	if owners == nil {
		t.Fatal("owners = nil, want an empty slice")
	}
	if len(owners) != 0 {
		t.Fatalf("owners = %+v, want empty", owners)
	}
}
