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

func TestMatchingBranchesStripsRefPrefix(t *testing.T) {
	fake := &fakeActions{router: func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/repos/octocat/draft/git/matching-refs/heads/opendraft/ada/" {
			t.Errorf("path = %q", r.URL.Path)
		}
		_, _ = w.Write([]byte(`[
			{"ref":"refs/heads/opendraft/ada/20260101-120000","object":{"sha":"aaa111"}},
			{"ref":"refs/heads/opendraft/ada/20260102-130000","object":{"sha":"bbb222"}}
		]`))
	}}
	server := httptest.NewServer(fake.handler())
	t.Cleanup(server.Close)

	branches, err := testClient(server.URL, time.Now()).MatchingBranches(context.Background(), "ghu_token", "octocat", "draft", "opendraft/ada/")
	if err != nil {
		t.Fatalf("MatchingBranches: %v", err)
	}
	want := []BranchRef{
		{Name: "opendraft/ada/20260101-120000", SHA: "aaa111"},
		{Name: "opendraft/ada/20260102-130000", SHA: "bbb222"},
	}
	if len(branches) != len(want) {
		t.Fatalf("branches = %+v, want %+v", branches, want)
	}
	for i := range want {
		if branches[i] != want[i] {
			t.Errorf("branches[%d] = %+v, want %+v", i, branches[i], want[i])
		}
	}
	calls := fake.snapshot()
	if len(calls) != 1 || calls[0].auth != "Bearer ghu_token" {
		t.Fatalf("calls = %+v", calls)
	}
}

func TestMatchingBranchesEmpty(t *testing.T) {
	fake := &fakeActions{router: func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`[]`))
	}}
	server := httptest.NewServer(fake.handler())
	t.Cleanup(server.Close)

	branches, err := testClient(server.URL, time.Now()).MatchingBranches(context.Background(), "ghu_token", "octocat", "draft", "opendraft/ada/")
	if err != nil {
		t.Fatalf("MatchingBranches: %v", err)
	}
	if branches == nil {
		t.Fatal("branches = nil, want an empty slice")
	}
	if len(branches) != 0 {
		t.Fatalf("branches = %+v, want empty", branches)
	}
}

func TestLatestPullStates(t *testing.T) {
	tests := []struct {
		name  string
		body  string
		found bool
		want  PullInfo
	}{
		{
			name:  "open",
			body:  `[{"number":12,"html_url":"https://github.example/octocat/draft/pull/12","state":"open","merged_at":null}]`,
			found: true,
			want:  PullInfo{Number: 12, HTMLURL: "https://github.example/octocat/draft/pull/12", State: "open"},
		},
		{
			name:  "closed",
			body:  `[{"number":13,"html_url":"https://github.example/octocat/draft/pull/13","state":"closed","merged_at":null}]`,
			found: true,
			want:  PullInfo{Number: 13, HTMLURL: "https://github.example/octocat/draft/pull/13", State: "closed"},
		},
		{
			name:  "merged",
			body:  `[{"number":14,"html_url":"https://github.example/octocat/draft/pull/14","state":"closed","merged_at":"2026-01-01T12:00:00Z"}]`,
			found: true,
			want:  PullInfo{Number: 14, HTMLURL: "https://github.example/octocat/draft/pull/14", State: "merged"},
		},
		{
			name:  "none",
			body:  `[]`,
			found: false,
			want:  PullInfo{},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fake := &fakeActions{router: func(w http.ResponseWriter, _ *http.Request) {
				_, _ = w.Write([]byte(tt.body))
			}}
			server := httptest.NewServer(fake.handler())
			t.Cleanup(server.Close)

			pull, found, err := testClient(server.URL, time.Now()).LatestPull(context.Background(), "ghu_token", "octocat", "draft", "octocat:opendraft/ada/20260101-120000")
			if err != nil {
				t.Fatalf("LatestPull: %v", err)
			}
			if found != tt.found {
				t.Fatalf("found = %v, want %v", found, tt.found)
			}
			if pull != tt.want {
				t.Fatalf("pull = %+v, want %+v", pull, tt.want)
			}
			calls := fake.snapshot()
			if len(calls) != 1 {
				t.Fatalf("calls = %+v", calls)
			}
			if calls[0].path != "/repos/octocat/draft/pulls" {
				t.Errorf("path = %q", calls[0].path)
			}
			query := calls[0].query
			for _, param := range []string{
				"head=octocat%3Aopendraft%2Fada%2F20260101-120000",
				"state=all",
				"sort=created",
				"direction=desc",
				"per_page=1",
			} {
				if !strings.Contains(query, param) {
					t.Errorf("query %q does not contain %q", query, param)
				}
			}
		})
	}
}

func TestMergeUpstream(t *testing.T) {
	fake := &fakeActions{router: func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/repos/octocat/draft/merge-upstream" {
			t.Errorf("path = %q", r.URL.Path)
		}
		_, _ = w.Write([]byte(`{"merge_type":"fast-forward","base_branch":"main"}`))
	}}
	server := httptest.NewServer(fake.handler())
	t.Cleanup(server.Close)

	err := testClient(server.URL, time.Now()).MergeUpstream(context.Background(), "ghu_token", "octocat", "draft", "main")
	if err != nil {
		t.Fatalf("MergeUpstream: %v", err)
	}
	calls := fake.snapshot()
	if len(calls) != 1 || calls[0].method != http.MethodPost {
		t.Fatalf("calls = %+v", calls)
	}
	if calls[0].body["branch"] != "main" {
		t.Errorf("body = %+v", calls[0].body)
	}
}

func TestMergeUpstreamConflict(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusConflict)
		_, _ = w.Write([]byte(`{"message":"merge conflict"}`))
	}))
	t.Cleanup(server.Close)

	err := testClient(server.URL, time.Now()).MergeUpstream(context.Background(), "ghu_token", "octocat", "draft", "main")
	if !errors.Is(err, ErrConflict) {
		t.Fatalf("err = %v, want ErrConflict", err)
	}
}
