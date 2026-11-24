package github

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
)

func TestMatchingBranchesStripsRefPrefix(t *testing.T) {
	fake := &fakeActions{router: func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != testSuggestionRefs {
			t.Errorf(pathFormat, r.URL.Path)
		}
		_, _ = w.Write([]byte(`[
			{"ref":"refs/heads/` + testSuggestionBranch + `","object":{"sha":"aaa111"}},
			{"ref":"refs/heads/` + testSuggestionBranch2 + `","object":{"sha":"bbb222"}}
		]`))
	}}
	server := httptest.NewServer(fake.handler())
	t.Cleanup(server.Close)

	branches, err := testClient(server.URL, time.Now()).MatchingBranches(context.Background(), testToken, testOwner, testRepo, testSuggestionPrefix)
	if err != nil {
		t.Fatalf("MatchingBranches: %v", err)
	}
	want := []BranchRef{
		{Name: testSuggestionBranch, SHA: "aaa111"},
		{Name: testSuggestionBranch2, SHA: "bbb222"},
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
	if len(calls) != 1 || calls[0].auth != testBearer {
		t.Fatalf(callsFormat, calls)
	}
}

func TestMatchingBranchesEmpty(t *testing.T) {
	fake := &fakeActions{router: func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(testEmptyJSON))
	}}
	server := httptest.NewServer(fake.handler())
	t.Cleanup(server.Close)

	branches, err := testClient(server.URL, time.Now()).MatchingBranches(context.Background(), testToken, testOwner, testRepo, testSuggestionPrefix)
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

type latestPullCase struct {
	name    string
	body    string
	reviews string
	want    PullInfo
	found   bool
}

func newLatestPullRouter(body, reviews string) func(http.ResponseWriter, *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/reviews") {
			_, _ = w.Write([]byte(reviews))
			return
		}
		_, _ = w.Write([]byte(body))
	}
}

func checkLatestPull(t *testing.T, tt latestPullCase) {
	t.Helper()
	fake := &fakeActions{router: newLatestPullRouter(tt.body, tt.reviews)}
	server := httptest.NewServer(fake.handler())
	t.Cleanup(server.Close)

	pull, found, err := testClient(server.URL, time.Now()).LatestPull(context.Background(), testToken, testOwner, testRepo, testHeadLabel)
	if err != nil {
		t.Fatalf(latestPullFailed, err)
	}
	if found != tt.found {
		t.Fatalf("found = %v, want %v", found, tt.found)
	}
	if pull != tt.want {
		t.Fatalf("pull = %+v, want %+v", pull, tt.want)
	}
	assertLatestPullCalls(t, tt.found, fake.snapshot())
}

func assertLatestPullCalls(t *testing.T, found bool, calls []actionCall) {
	t.Helper()
	wantCalls := 1
	if found {
		wantCalls = 2
	}
	if len(calls) != wantCalls {
		t.Fatalf(callsFormat+", want %d", calls, wantCalls)
	}
	if calls[0].path != pullsPath {
		t.Errorf(pathFormat, calls[0].path)
	}
	assertLatestPullQuery(t, calls[0].query)
	if found {
		assertReviewPath(t, calls[1].path)
	}
}

func assertLatestPullQuery(t *testing.T, query string) {
	t.Helper()
	for _, param := range []string{
		"head=" + url.QueryEscape(testHeadLabel),
		"state=all",
		"sort=created",
		"direction=desc",
		"per_page=1",
	} {
		if !strings.Contains(query, param) {
			t.Errorf("query %q does not contain %q", query, param)
		}
	}
}

func assertReviewPath(t *testing.T, path string) {
	t.Helper()
	if !strings.HasSuffix(path, "/pulls/12/reviews") &&
		!strings.Contains(path, "/pulls/13/reviews") &&
		!strings.Contains(path, "/pulls/14/reviews") {
		t.Errorf("reviews path = %q", path)
	}
}

func TestLatestPullStates(t *testing.T) {
	openPrefix := `[{"number":12,"html_url":"` + pullURL + `","state":"open","merged_at":null,"head":{"label":"`
	openSuffix := `"}}]`
	openBody := openPrefix + testHeadLabel + openSuffix
	tests := []latestPullCase{
		{
			name:    "open",
			body:    openBody,
			reviews: testEmptyJSON,
			found:   true,
			want:    PullInfo{Number: 12, HTMLURL: pullURL, State: testStateOpen, ReviewState: testReviewNone},
		},
		{
			name:    "closed",
			body:    `[{"number":13,"html_url":"` + testPull13URL + `","state":"closed","merged_at":null,"head":{"label":"` + testHeadLabel + `"}}]`,
			reviews: testEmptyJSON,
			found:   true,
			want:    PullInfo{Number: 13, HTMLURL: testPull13URL, State: "closed", ReviewState: testReviewNone},
		},
		{
			name:    "merged",
			body:    `[{"number":14,"html_url":"` + testPull14URL + `","state":"closed","merged_at":"2026-01-01T12:00:00Z","head":{"label":"` + testHeadLabel + `"}}]`,
			reviews: testEmptyJSON,
			found:   true,
			want:    PullInfo{Number: 14, HTMLURL: testPull14URL, State: "merged", ReviewState: testReviewNone},
		},
		{
			name:    "changes requested",
			body:    openBody,
			reviews: `[{"id":1,"state":"APPROVED","user":{"login":"ada"}},{"id":2,"state":"CHANGES_REQUESTED","user":{"login":"grace"}}]`,
			found:   true,
			want:    PullInfo{Number: 12, HTMLURL: pullURL, State: testStateOpen, ReviewState: "changes_requested"},
		},
		{
			name:    "approved after earlier change request",
			body:    openBody,
			reviews: `[{"id":1,"state":"CHANGES_REQUESTED","user":{"login":"grace"}},{"id":2,"state":"APPROVED","user":{"login":"ada"}},{"id":3,"state":"APPROVED","user":{"login":"grace"}}]`,
			found:   true,
			want:    PullInfo{Number: 12, HTMLURL: pullURL, State: testStateOpen, ReviewState: "approved"},
		},
		{
			name:    "none",
			body:    testEmptyJSON,
			reviews: testEmptyJSON,
			found:   false,
			want:    PullInfo{},
		},
		{
			name:    "pull request from another head",
			body:    `[{"number":6,"html_url":"` + testPull6URL + `","state":"closed","merged_at":"2026-01-01T12:00:00Z","head":{"label":"` + testOwner + `:add-abstract"}}]`,
			reviews: testEmptyJSON,
			found:   false,
			want:    PullInfo{},
		},
		{
			name:    "head label matches ignoring case",
			body:    `[{"number":12,"html_url":"` + pullURL + `","state":"open","merged_at":null,"head":{"label":"Octocat:Opendraft/Ada/20260101-120000"}}]`,
			reviews: testEmptyJSON,
			found:   true,
			want:    PullInfo{Number: 12, HTMLURL: pullURL, State: testStateOpen, ReviewState: testReviewNone},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			checkLatestPull(t, tt)
		})
	}
}

func TestMergeUpstream(t *testing.T) {
	fake := &fakeActions{router: func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != settingsPath+"/merge-upstream" {
			t.Errorf("path = %q", r.URL.Path)
		}
		_, _ = w.Write([]byte(`{"merge_type":"fast-forward","base_branch":"` + testDefaultBranch + `"}`))
	}}
	server := httptest.NewServer(fake.handler())
	t.Cleanup(server.Close)

	err := testClient(server.URL, time.Now()).MergeUpstream(context.Background(), testToken, testOwner, testRepo, testDefaultBranch)
	if err != nil {
		t.Fatalf("MergeUpstream: %v", err)
	}
	calls := fake.snapshot()
	if len(calls) != 1 || calls[0].method != http.MethodPost {
		t.Fatalf(callsFormat, calls)
	}
	if calls[0].body["branch"] != testDefaultBranch {
		t.Errorf("body = %+v", calls[0].body)
	}
}

func TestMergeUpstreamConflict(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusConflict)
		_, _ = w.Write([]byte(`{"message":"merge conflict"}`))
	}))
	t.Cleanup(server.Close)

	err := testClient(server.URL, time.Now()).MergeUpstream(context.Background(), testToken, testOwner, testRepo, testDefaultBranch)
	if !errors.Is(err, ErrConflict) {
		t.Fatalf("err = %v, want ErrConflict", err)
	}
}
