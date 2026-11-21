package httpapi

import (
	"bytes"
	"encoding/base64"
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

type relayCall struct {
	path   string
	query  string
	header http.Header
	body   string
}

type fakeGitRelay struct {
	server       *httptest.Server
	mu           sync.Mutex
	calls        []relayCall
	status       int
	response     string
	contentType  string
	cacheControl string
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
	cfg := config.Config{
		PublicOrigin:       reposTestOrigin,
		GitHubClientID:     "client-id",
		GitHubClientSecret: "client-secret",
		GitHubAppSlug:      "opendraft-app",
		GitHubWebURL:       fake.server.URL,
		GitHubAPIURL:       fake.server.URL,
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

func TestGitRelayWithoutSessionReturnsUnauthorized(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	fake := newFakeGitRelay(t)
	handler, _ := newGitRelayServer(t, fake, now)

	rec := serveGitRelay(t, handler, nil, now, http.MethodGet, "/@api/git/octocat/draft.git/info/refs?service=git-upload-pack", nil, false)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
	if body := decodeJSON(t, rec); body["error"] != unauthenticatedCode {
		t.Errorf("error = %q, want %q", body["error"], unauthenticatedCode)
	}
	if fake.count() != 0 {
		t.Errorf("upstream received %d requests, want 0", fake.count())
	}
}

func TestGitRelayForwardsAllowedRequests(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	tests := []struct {
		name      string
		method    string
		target    string
		body      string
		wantPath  string
		wantQuery string
		wantBody  string
	}{
		{
			name:      "info refs upload pack",
			method:    http.MethodGet,
			target:    "/@api/git/octocat/draft.git/info/refs?service=git-upload-pack",
			wantPath:  "/octocat/draft.git/info/refs",
			wantQuery: "service=git-upload-pack",
		},
		{
			name:      "info refs receive pack",
			method:    http.MethodGet,
			target:    "/@api/git/octocat/draft.git/info/refs?service=git-receive-pack",
			wantPath:  "/octocat/draft.git/info/refs",
			wantQuery: "service=git-receive-pack",
		},
		{
			name:     "upload pack post",
			method:   http.MethodPost,
			target:   "/@api/git/octocat/draft.git/git-upload-pack",
			body:     "upload-request-body",
			wantPath: "/octocat/draft.git/git-upload-pack",
			wantBody: "upload-request-body",
		},
		{
			name:     "receive pack post",
			method:   http.MethodPost,
			target:   "/@api/git/octocat/draft.git/git-receive-pack",
			body:     "receive-request-body",
			wantPath: "/octocat/draft.git/git-receive-pack",
			wantBody: "receive-request-body",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fake := newFakeGitRelay(t)
			fake.status = http.StatusCreated
			handler, sealer := newGitRelayServer(t, fake, now)

			var reader io.Reader
			if tt.body != "" {
				reader = bytes.NewBufferString(tt.body)
			}
			req := httptest.NewRequest(tt.method, tt.target, reader)
			req.Header.Set("Origin", reposTestOrigin)
			req.Header.Set("Content-Type", "application/x-git-upload-pack-request")
			req.Header.Set("Accept", "application/x-git-upload-pack-result")
			req.Header.Set("Git-Protocol", "version=2")
			req.Header.Set("Content-Encoding", "gzip")
			req.Header.Set("Authorization", "Bearer client-token")
			req.Header.Set("Cookie", "client-cookie=secret")
			req.AddCookie(sessionCookie(t, sealer, liveSession(now), now))

			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)

			if rec.Code != http.StatusCreated {
				t.Fatalf("status = %d, want 201: %s", rec.Code, rec.Body.String())
			}
			if got := rec.Body.String(); got != fake.response {
				t.Errorf("body = %q, want %q", got, fake.response)
			}
			if got := rec.Header().Get("Content-Type"); got != fake.contentType {
				t.Errorf("Content-Type = %q, want %q", got, fake.contentType)
			}
			if got := rec.Header().Get("Cache-Control"); got != fake.cacheControl {
				t.Errorf("Cache-Control = %q, want %q", got, fake.cacheControl)
			}

			call := fake.last(t)
			if call.path != tt.wantPath || call.query != tt.wantQuery || call.body != tt.wantBody {
				t.Errorf("upstream = %s?%s body %q, want %s?%s body %q", call.path, call.query, call.body, tt.wantPath, tt.wantQuery, tt.wantBody)
			}
			wantHeaders := map[string]string{
				"Authorization":    "Basic " + base64.StdEncoding.EncodeToString([]byte("x-access-token:old-access")),
				"User-Agent":       gitUserAgent,
				"Cookie":           "",
				"Content-Type":     "application/x-git-upload-pack-request",
				"Accept":           "application/x-git-upload-pack-result",
				"Git-Protocol":     "version=2",
				"Content-Encoding": "gzip",
			}
			for name, want := range wantHeaders {
				if got := call.header.Get(name); got != want {
					t.Errorf("upstream %s = %q, want %q", name, got, want)
				}
			}
		})
	}
}

func TestGitRelayRejectsUnsupportedTargets(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	tests := []struct {
		name   string
		method string
		target string
	}{
		{name: "get other rest", method: http.MethodGet, target: "/@api/git/octocat/draft.git/objects/info/packs"},
		{name: "get unknown service", method: http.MethodGet, target: "/@api/git/octocat/draft.git/info/refs?service=git-upload-archive"},
		{name: "get missing service", method: http.MethodGet, target: "/@api/git/octocat/draft.git/info/refs"},
		{name: "post unsupported rest", method: http.MethodPost, target: "/@api/git/octocat/draft.git/git-upload-archive"},
		{name: "repo without git suffix", method: http.MethodGet, target: "/@api/git/octocat/draft/info/refs?service=git-upload-pack"},
		{name: "invalid owner", method: http.MethodGet, target: "/@api/git/bad_owner/draft.git/info/refs?service=git-upload-pack"},
		{name: "empty repo stem", method: http.MethodGet, target: "/@api/git/octocat/.git/info/refs?service=git-upload-pack"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fake := newFakeGitRelay(t)
			handler, sealer := newGitRelayServer(t, fake, now)

			rec := serveGitRelay(t, handler, sealer, now, tt.method, tt.target, nil, true)

			if rec.Code != http.StatusNotFound {
				t.Fatalf("status = %d, want 404: %s", rec.Code, rec.Body.String())
			}
			if body := decodeJSON(t, rec); body["error"] != errorCode {
				t.Errorf("error = %q, want %q", body["error"], errorCode)
			}
			if fake.count() != 0 {
				t.Errorf("upstream received %d requests, want 0", fake.count())
			}
		})
	}
}

func TestGitRelayRejectsOversizedBody(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	fake := newFakeGitRelay(t)
	handler, sealer := newGitRelayServer(t, fake, now)
	req := httptest.NewRequest(http.MethodPost, "/@api/git/octocat/draft.git/git-upload-pack", nil)
	req.Header.Set("Origin", reposTestOrigin)
	req.ContentLength = maxGitBodyBytes + 1
	req.Body = io.NopCloser(io.LimitReader(bytes.NewReader(nil), maxGitBodyBytes+1))
	req.AddCookie(sessionCookie(t, sealer, liveSession(now), now))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, want 413: %s", rec.Code, rec.Body.String())
	}
	if body := decodeJSON(t, rec); body["error"] != tooLargeCode {
		t.Errorf("error = %q, want %q", body["error"], tooLargeCode)
	}
	if fake.count() != 0 {
		t.Errorf("upstream received %d requests, want 0", fake.count())
	}
}
