package httpapi

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/konsulin-care/opendraft/apps/bff/internal/config"
	"github.com/konsulin-care/opendraft/apps/bff/internal/github"
	"github.com/konsulin-care/opendraft/apps/bff/internal/session"
)

const (
	testPublicOrigin      = "https://publish.example"
	reposTestOrigin       = testPublicOrigin
	testEvilOrigin        = "https://evil.example"
	testVersion           = "1.2.3"
	testClientID          = "client-id"
	testClientSecret      = "client-secret"
	testAppSlug           = "opendraft-app"
	testOwner             = "octocat"
	testFullName          = "The Octocat"
	testOldAccess         = "old-access"
	testRepo              = "draft"
	testDefaultBranch     = "main"
	testInvalidOwner      = "invalid owner"
	testPublicVisibility  = "public"
	testPrivateVisibility = "private"
)

const testRepoPath = "/repos/" + testOwner + "/" + testRepo
const testRepoAPIPath = "/@api/repos/" + testOwner + "/" + testRepo
const testPullsPath = testRepoPath + "/pulls"
const testReviewsPath = testPullsPath + "/12/reviews"
const testPullHead = testOwner + ":opendraft/ada/20260101-120000"
const testPullLookupPrefix = testRepoAPIPath + "/pulls?head="
const testPullLookupPath = testPullLookupPrefix + testPullHead
const testBranchesPath = testRepoAPIPath + "/branches"
const testBranchAPIPrefix = testBranchesPath + "/"
const testMergeUpstreamPath = testRepoPath + "/merge-upstream"
const testMergeUpstreamAPI = testRepoAPIPath + "/merge-upstream"
const testMatchingRefsPath = testRepoPath + "/git/matching-refs/heads/"
const testRefsPath = testRepoPath + "/git/refs/heads/"

// assertRejectedRepoAction asserts method path answers 400 invalid_request with
// wantField and makes no GitHub request.
func assertRejectedRepoAction(t *testing.T, now time.Time, method, path, wantField string) {
	t.Helper()

	fake := &fakeRepoActions{router: func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}}
	handler, sealer := newRepoActionsServer(t, fake, now)
	rec := serveRepoAction(t, handler, sealer, now, method, path, nil)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400: %s", rec.Code, rec.Body.String())
	}
	body := decodeJSON(t, rec)
	if body[errorKey] != invalidRequestCode || body["field"] != wantField {
		t.Errorf("body = %v, want field %q", body, wantField)
	}
	if fake.count() != 0 {
		t.Errorf("GitHub received %d requests, want 0", fake.count())
	}
}

// newPullLookupFake returns a fake GitHub router answering the pulls list and
// reviews endpoints with the given JSON bodies.
func newPullLookupFake(t *testing.T, pullsJSON, reviewsJSON string) *fakeRepoActions {
	t.Helper()
	return &fakeRepoActions{router: func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case testPullsPath:
			_, _ = w.Write([]byte(pullsJSON))
		case testReviewsPath:
			_, _ = w.Write([]byte(reviewsJSON))
		default:
			t.Errorf("path = %q", r.URL.Path)
		}
	}}
}

// decodeBranchRefs decodes a branches endpoint answer.
func decodeBranchRefs(t *testing.T, rec *httptest.ResponseRecorder) []map[string]string {
	t.Helper()
	var body []map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	return body
}

// decodePullLookup asserts rec is a 200 answer and decodes its JSON body.
func decodePullLookup(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", rec.Code, rec.Body.String())
	}
	return decodeAnyJSON(t, rec)
}

// newGitHubBackedServer builds the full BFF handler against a fake GitHub
// server used for both the web and API URLs.
func newGitHubBackedServer(t *testing.T, apiURL string, now time.Time) (http.Handler, *session.Sealer) {
	t.Helper()

	cfg := config.Config{
		PublicOrigin:       reposTestOrigin,
		GitHubClientID:     testClientID,
		GitHubClientSecret: testClientSecret,
		GitHubAppSlug:      testAppSlug,
		GitHubWebURL:       apiURL,
		GitHubAPIURL:       apiURL,
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
			WebURL:       cfg.GitHubWebURL,
			APIURL:       cfg.GitHubAPIURL,
			ClientID:     cfg.GitHubClientID,
			ClientSecret: cfg.GitHubClientSecret,
			Now:          func() time.Time { return now },
		},
		Sealer: sealer,
	}
	return New(cfg, deps), sealer
}

type relayCall struct {
	header http.Header
	path   string
	query  string
	body   string
}

type fakeGitRelay struct {
	server       *httptest.Server
	response     string
	contentType  string
	cacheControl string
	calls        []relayCall
	mu           sync.Mutex
	status       int
}

func newFakeGitRelay(t *testing.T) *fakeGitRelay {
	t.Helper()
	f := &fakeGitRelay{
		status:       http.StatusOK,
		response:     "upstream-body",
		contentType:  "application/x-git-upload-pack-advertisement",
		cacheControl: "no-cache",
	}
	f.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		f.mu.Lock()
		f.calls = append(f.calls, relayCall{
			path:   r.URL.Path,
			query:  r.URL.RawQuery,
			header: r.Header.Clone(),
			body:   string(body),
		})
		status, response := f.status, f.response
		contentType, cacheControl := f.contentType, f.cacheControl
		f.mu.Unlock()

		w.Header().Set("Content-Type", contentType)
		w.Header().Set("Cache-Control", cacheControl)
		w.WriteHeader(status)
		_, _ = w.Write([]byte(response))
	}))
	t.Cleanup(f.server.Close)
	return f
}

func (f *fakeGitRelay) count() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.calls)
}

func (f *fakeGitRelay) last(t *testing.T) relayCall {
	t.Helper()
	f.mu.Lock()
	defer f.mu.Unlock()
	if len(f.calls) == 0 {
		t.Fatal("upstream received no requests")
	}
	return f.calls[len(f.calls)-1]
}

func newGitRelayServer(t *testing.T, fake *fakeGitRelay, now time.Time) (http.Handler, *session.Sealer) {
	t.Helper()
	return newGitHubBackedServer(t, fake.server.URL, now)
}

func serveGitRelay(t *testing.T, handler http.Handler, sealer *session.Sealer, now time.Time, method, target string, body io.Reader, authenticated bool) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, target, body)
	req.Header.Set("Origin", reposTestOrigin)
	if authenticated {
		req.AddCookie(sessionCookie(t, sealer, liveSession(now), now))
	}
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}
